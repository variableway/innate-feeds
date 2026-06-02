package store

import (
	"database/sql"
	"fmt"
	"time"
)

type APIKey struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	KeyHash    string `json:"key_hash"`
	CreatedAt  int64  `json:"created_at"`
	LastUsedAt int64  `json:"last_used_at"`
}

// CreateAPIKey inserts a new API key (store the bcrypt hash, not the plaintext).
func (s *Store) CreateAPIKey(name, keyHash string) (int64, error) {
	query := `INSERT INTO api_keys (name, key_hash) VALUES (:name, :key_hash) RETURNING id`

	var id int64
	var err error

	if s.driver == "postgres" {
		err = s.db.QueryRow(query,
			sql.Named("name", name),
			sql.Named("key_hash", keyHash),
		).Scan(&id)
	} else {
		res, err2 := s.db.Exec(query,
			sql.Named("name", name),
			sql.Named("key_hash", keyHash),
		)
		if err2 != nil {
			return 0, fmt.Errorf("create api key: %w", err2)
		}
		id, err = res.LastInsertId()
	}
	if err != nil {
		return 0, fmt.Errorf("create api key: %w", err)
	}
	return id, nil
}

// ListAPIKeys returns all API keys ordered by creation time.
func (s *Store) ListAPIKeys() ([]*APIKey, error) {
	rows, err := s.db.Query(`SELECT id, name, key_hash, created_at, last_used_at FROM api_keys ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list api keys: %w", err)
	}
	defer rows.Close()

	var keys []*APIKey
	for rows.Next() {
		var k APIKey
		if err := rows.Scan(&k.ID, &k.Name, &k.KeyHash, &k.CreatedAt, &k.LastUsedAt); err != nil {
			return nil, fmt.Errorf("scan api key: %w", err)
		}
		keys = append(keys, &k)
	}
	return keys, rows.Err()
}

// DeleteAPIKey removes an API key by ID.
func (s *Store) DeleteAPIKey(id int64) error {
	_, err := s.db.Exec(`DELETE FROM api_keys WHERE id = :id`, sql.Named("id", id))
	if err != nil {
		return fmt.Errorf("delete api key: %w", err)
	}
	return nil
}

// GetAPIKeyByHash looks up an API key by its hash and updates last_used_at.
func (s *Store) GetAPIKeyByHash(keyHash string) (*APIKey, error) {
	var k APIKey
	err := s.db.QueryRow(
		`SELECT id, name, key_hash, created_at, last_used_at FROM api_keys WHERE key_hash = :key_hash`,
		sql.Named("key_hash", keyHash),
	).Scan(&k.ID, &k.Name, &k.KeyHash, &k.CreatedAt, &k.LastUsedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get api key: %w", err)
	}

	// Update last_used_at
	nowSec := time.Now().Unix()
	_, _ = s.db.Exec(
		`UPDATE api_keys SET last_used_at = :now WHERE id = :id`,
		sql.Named("now", nowSec),
		sql.Named("id", k.ID),
	)
	return &k, nil
}
