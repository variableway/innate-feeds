-- Sessions: persistent session storage (replaces in-memory map)
CREATE TABLE IF NOT EXISTS sessions (
    id          SERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL UNIQUE,
    expires_at  BIGINT NOT NULL,
    created_at  BIGINT NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- API Keys: for programmatic access (e.g. InsForge integration, third-party clients)
CREATE TABLE IF NOT EXISTS api_keys (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL DEFAULT '',
    key_hash     TEXT NOT NULL UNIQUE,
    created_at   BIGINT NOT NULL DEFAULT (unixepoch()),
    last_used_at BIGINT DEFAULT 0
);
