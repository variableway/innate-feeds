-- Sessions: persistent session storage (replaces in-memory map)
CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- API Keys: for programmatic access (e.g. InsForge integration, third-party clients)
CREATE TABLE IF NOT EXISTS api_keys (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    key_hash    TEXT NOT NULL UNIQUE,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used_at INTEGER DEFAULT 0
);
