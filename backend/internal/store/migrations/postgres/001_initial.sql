-- PostgreSQL initial schema
-- Compatible with InsForge and other PostgreSQL providers.

-- Helper function to match SQLite's unixepoch()
CREATE OR REPLACE FUNCTION unixepoch() RETURNS bigint AS $$
BEGIN
    RETURN EXTRACT(EPOCH FROM NOW())::bigint;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TABLE IF NOT EXISTS groups (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO groups (id, name) VALUES (1, 'Default')
    ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS feeds (
    id         BIGSERIAL PRIMARY KEY,
    group_id   BIGINT NOT NULL DEFAULT 1 REFERENCES groups(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    name       TEXT NOT NULL,
    link       TEXT NOT NULL UNIQUE,
    site_url   TEXT DEFAULT '',
    suspended  INTEGER DEFAULT 0,
    proxy      TEXT DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_feeds_group_id ON feeds(group_id);

CREATE TABLE IF NOT EXISTS items (
    id         BIGSERIAL PRIMARY KEY,
    feed_id    BIGINT NOT NULL REFERENCES feeds(id) ON UPDATE CASCADE ON DELETE CASCADE,
    guid       TEXT NOT NULL,
    title      TEXT DEFAULT '',
    link       TEXT DEFAULT '',
    content    TEXT DEFAULT '',
    pub_date   INTEGER DEFAULT 0,
    unread     INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_feed_guid ON items(feed_id, guid);
CREATE INDEX IF NOT EXISTS idx_items_unread ON items(unread) WHERE unread = 1;
CREATE INDEX IF NOT EXISTS idx_items_pub_date ON items(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_items_feed_unread ON items(feed_id, unread);

-- PostgreSQL full-text search (replaces SQLite FTS5)
CREATE TABLE IF NOT EXISTS items_fts_doc (
    item_id      BIGINT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    search_vector tsvector
);
CREATE INDEX IF NOT EXISTS idx_items_fts_search ON items_fts_doc USING GIN(search_vector);

-- Populate existing data on first run
INSERT INTO items_fts_doc(item_id, search_vector)
SELECT id, to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, ''))
FROM items
ON CONFLICT(item_id) DO UPDATE SET search_vector = EXCLUDED.search_vector;

-- Trigger to keep tsvector in sync
CREATE OR REPLACE FUNCTION items_fts_sync() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO items_fts_doc(item_id, search_vector)
        VALUES (NEW.id, to_tsvector('simple', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '')));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE items_fts_doc SET
            search_vector = to_tsvector('simple', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''))
        WHERE item_id = NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM items_fts_doc WHERE item_id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_fts_trigger ON items;
CREATE TRIGGER items_fts_trigger
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH ROW EXECUTE FUNCTION items_fts_sync();

CREATE TABLE IF NOT EXISTS bookmarks (
    id         BIGSERIAL PRIMARY KEY,
    item_id    BIGINT REFERENCES items(id) ON UPDATE CASCADE ON DELETE SET NULL,
    link       TEXT NOT NULL UNIQUE,
    title      TEXT DEFAULT '',
    content    TEXT DEFAULT '',
    pub_date   INTEGER DEFAULT 0,
    feed_name  TEXT DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
