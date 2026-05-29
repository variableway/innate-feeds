-- Add source_type to feeds for adapter-based sources.

ALTER TABLE feeds ADD COLUMN source_type TEXT NOT NULL DEFAULT 'rss';
CREATE INDEX IF NOT EXISTS idx_feeds_source_type ON feeds(source_type);
