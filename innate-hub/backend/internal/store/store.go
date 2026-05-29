// Package store provides data access layer for Innate Hub.
//
// Supports both SQLite (default, self-contained) and PostgreSQL (for InsForge
// and other cloud providers). The driver is auto-detected from the DSN:
//   - "postgres://..." or "postgresql://..." → PostgreSQL
//   - anything else → SQLite
//
// All timestamps are stored as Unix epoch seconds (INTEGER).
// Boolean fields are stored as INTEGER (0/1) and converted to/from Go bool.
// Named SQL parameters (:param_name) are used throughout for safety.
package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"

	_ "github.com/jackc/pgx/v5/stdlib"
	"modernc.org/sqlite"
)

type Store struct {
	db     *sql.DB
	driver string // "sqlite" or "postgres"
}

var sqliteHookOnce sync.Once

// New opens a database connection. The driver is auto-detected from dbPath:
//   - postgres:// or postgresql:// prefix → PostgreSQL (via pgx)
//   - anything else → SQLite (via modernc.org/sqlite)
func New(dbPath string) (*Store, error) {
	if looksLikePostgres(dbPath) {
		return newPostgres(dbPath)
	}
	return newSQLite(dbPath)
}

func looksLikePostgres(dsn string) bool {
	return strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://")
}

func newSQLite(dbPath string) (*Store, error) {
	sqliteHookOnce.Do(func() {
		sqlite.RegisterConnectionHook(func(conn sqlite.ExecQuerierContext, _ string) error {
			ctx := context.Background()
			if _, err := conn.ExecContext(ctx, "PRAGMA foreign_keys = ON", nil); err != nil {
				return fmt.Errorf("enable foreign_keys: %w", err)
			}
			if _, err := conn.ExecContext(ctx, "PRAGMA busy_timeout = 5000", nil); err != nil {
				return fmt.Errorf("set busy_timeout: %w", err)
			}
			if _, err := conn.ExecContext(ctx, "PRAGMA journal_mode = WAL", nil); err != nil {
				return fmt.Errorf("set journal_mode: %w", err)
			}
			return nil
		})
	})

	if err := prepareLegacyDatabase(dbPath); err != nil {
		return nil, fmt.Errorf("prepare legacy database: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	s := &Store{db: db, driver: "sqlite"}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate database: %w", err)
	}

	return s, nil
}

func newPostgres(dsn string) (*Store, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	s := &Store{db: db, driver: "postgres"}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate database: %w", err)
	}

	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

// DB returns the underlying *sql.DB connection.
func (s *Store) DB() *sql.DB {
	return s.db
}

// Driver returns the database driver name ("sqlite" or "postgres").
func (s *Store) Driver() string {
	return s.driver
}
