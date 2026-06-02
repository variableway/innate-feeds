package store

import (
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"
)

// vectorInit enables native vector support on the database. It is called
// once after migrations run. Returns true when native vector ops are
// available for the configured dim; false when the store must fall back
// to in-Go brute-force similarity search.
//
// Behavior by driver:
//
//   - postgres: tries to CREATE EXTENSION vector; if the user has pgvector
//     installed, adds an `embedding_vec vector(dim)` column on the items
//     table and an HNSW index. Native similarity uses the `<=>` operator.
//
//   - sqlite:   no native operator. The brute-force path in Go is used.
//     (sqlite-vec is not bundled by default; a future extension could
//     add it without changing the public API.)
func (s *Store) vectorInit(dim int) error {
	switch s.driver {
	case "postgres":
		return s.initPostgresVector(dim)
	default:
		// SQLite: vector support is "off" by design.
		s.vectorReady = false
		return nil
	}
}

// initPostgresVector ensures the vector extension exists, then adds a
// vector(dim) column on items if it isn't there yet.
func (s *Store) initPostgresVector(dim int) error {
	if dim <= 0 {
		dim = 1536
	}

	// The vector extension is provided by pgvector; if the user runs a
	// stock postgres:16 image without pgvector, this CREATE will fail and
	// we degrade to brute-force in Go.
	if _, err := s.db.Exec("CREATE EXTENSION IF NOT EXISTS vector"); err != nil {
		slog.Warn("pgvector extension unavailable; semantic search will use in-Go brute force", "error", err)
		s.vectorReady = false
		return nil
	}

	// Check if the column already exists.
	var hasColumn bool
	row := s.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_name = 'items' AND column_name = 'embedding_vec'
		)
	`)
	if err := row.Scan(&hasColumn); err != nil {
		slog.Warn("failed to check embedding_vec column; falling back to brute force", "error", err)
		s.vectorReady = false
		return nil
	}

	if !hasColumn {
		ddl := fmt.Sprintf("ALTER TABLE items ADD COLUMN embedding_vec vector(%d)", dim)
		if _, err := s.db.Exec(ddl); err != nil {
			slog.Warn("failed to add embedding_vec column; falling back to brute force", "dim", dim, "error", err)
			s.vectorReady = false
			return nil
		}
		// Best-effort HNSW index; not all pgvector builds support this.
		idxDDL := "CREATE INDEX IF NOT EXISTS items_embedding_vec_hnsw ON items USING hnsw (embedding_vec vector_cosine_ops)"
		if _, err := s.db.Exec(idxDDL); err != nil {
			slog.Info("HNSW index not created (probably <pgvector 0.5); will use seq scan or IVFFlat", "error", err)
		}
	} else {
		// Detect existing dim so callers know which dim to write at.
		existing, err := s.detectVectorDim()
		if err == nil && existing != dim {
			slog.Warn("embedding_vec dim differs from HUB_EMBEDDER_DIMENSIONS",
				"db_dim", existing, "config_dim", dim,
				"hint", "set HUB_EMBEDDER_DIMENSIONS to the existing value, or run: ALTER TABLE items ALTER COLUMN embedding_vec TYPE vector(<config_dim>)")
		}
	}

	s.vectorDim = dim
	s.vectorReady = true
	slog.Info("native vector search enabled", "driver", s.driver, "dim", dim)
	return nil
}

// detectVectorDim reads the current items.embedding_vec dimension from
// information_schema. Returns 0 if the column is missing or unreadable.
func (s *Store) detectVectorDim() (int, error) {
	var udtName string
	err := s.db.QueryRow(`
		SELECT udt_name FROM information_schema.columns
		WHERE table_name = 'items' AND column_name = 'embedding_vec'
	`).Scan(&udtName)
	if err != nil {
		return 0, err
	}
	// udt_name is "vector"; the dim lives in the column's data type modifier.
	// SELECT format_type(...) returns "vector(N)".
	var typeStr sql.NullString
	if err := s.db.QueryRow(`SELECT format_type(atttypid, atttypmod) FROM pg_attribute
		WHERE attrelid = 'items'::regclass AND attname = 'embedding_vec'`).Scan(&typeStr); err != nil {
		return 0, err
	}
	if !typeStr.Valid {
		return 0, errors.New("no type info")
	}
	typeDesc := typeStr.String
	open := strings.Index(typeDesc, "(")
	close := strings.LastIndex(typeDesc, ")")
	if open < 0 || close <= open {
		return 0, nil
	}
	var n int
	if _, err := fmt.Sscanf(typeDesc[open+1:close], "%d", &n); err != nil {
		return 0, err
	}
	return n, nil
}

// VectorReady reports whether native vector ops are available on this store.
func (s *Store) VectorReady() bool { return s.vectorReady }

// VectorDim returns the configured/expected vector dimension. Zero when
// native vector support is not active.
func (s *Store) VectorDim() int { return s.vectorDim }
