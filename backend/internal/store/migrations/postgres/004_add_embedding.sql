-- Add embedding column for semantic search.
-- Stored as float32 array in BYTEA. Empty/null means not yet embedded.

ALTER TABLE items ADD COLUMN embedding BYTEA;
