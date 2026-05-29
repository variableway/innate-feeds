package store

import (
	"database/sql"
	"fmt"
	"time"
)

// CreateSession inserts a new persistent session.
func (s *Store) CreateSession(sessionID string, expiresAt time.Time) error {
	query := `INSERT INTO sessions (session_id, expires_at) VALUES (:session_id, :expires_at)`
	_, err := s.db.Exec(query,
		sql.Named("session_id", sessionID),
		sql.Named("expires_at", expiresAt.Unix()),
	)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

// GetSession checks if a session exists and is not expired.
// Returns (true, nil) if valid; (false, nil) if missing or expired.
func (s *Store) GetSession(sessionID string) (bool, error) {
	nowSec := time.Now().Unix()

	// First, delete expired sessions to keep the table clean
	if _, err := s.db.Exec(`DELETE FROM sessions WHERE expires_at <= :now`, sql.Named("now", nowSec)); err != nil {
		// Non-fatal: just log and continue
		_ = err
	}

	var count int
	query := `SELECT COUNT(*) FROM sessions WHERE session_id = :session_id AND expires_at > :now`
	err := s.db.QueryRow(query,
		sql.Named("session_id", sessionID),
		sql.Named("now", nowSec),
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("get session: %w", err)
	}
	return count > 0, nil
}

// DeleteSession removes a session by ID.
func (s *Store) DeleteSession(sessionID string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE session_id = :session_id`, sql.Named("session_id", sessionID))
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

// DeleteExpiredSessions cleans up all expired sessions.
func (s *Store) DeleteExpiredSessions() error {
	nowSec := time.Now().Unix()
	_, err := s.db.Exec(`DELETE FROM sessions WHERE expires_at <= :now`, sql.Named("now", nowSec))
	if err != nil {
		return fmt.Errorf("delete expired sessions: %w", err)
	}
	return nil
}
