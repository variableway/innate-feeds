# Semantic Search Specification

## Overview

Innate Hub supports three search modes:

| Mode | Endpoint | Description |
|------|----------|-------------|
| **Keyword** | `GET /api/search?q=hello` | Full-text search (FTS5 / tsvector) |
| **Semantic** | `GET /api/search?q=hello&mode=semantic` | Vector similarity search (embedding) |
| **Hybrid** | `GET /api/search?q=hello&mode=hybrid` | Union of keyword + semantic, deduplicated |

## Architecture

```
User Query
    |
    v
+----------------------------+
|  Embedder (OpenAI/Ollama)  |  <-- optional, disabled if not configured
|  text → [float32] vector   |
+----------------------------+
    |
    v
+----------------------------+
|  Search Mode               |
|  • keyword:  FTS only      |
|  • semantic: vector cosine |
|  • hybrid:   union + dedup |
+----------------------------+
    |
    v
+----------------------------+
|  Store (SQLite / Postgres) |
|  items.embedding BLOB      |
+----------------------------+
```

## Embedder Providers

### OpenAI (cloud)

```bash
HUB_EMBEDDER_PROVIDER=openai
HUB_EMBEDDER_MODEL=text-embedding-3-small
HUB_EMBEDDER_API_KEY=sk-xxx
```

- **Model**: `text-embedding-3-small` (1536d, $0.02/1M tokens)
- **Model**: `text-embedding-3-large` (3072d, $0.13/1M tokens)
- **Dims**: auto-detected from model name

### Ollama (local)

```bash
HUB_EMBEDDER_PROVIDER=ollama
HUB_EMBEDDER_MODEL=nomic-embed-text
HUB_EMBEDDER_BASE_URL=http://localhost:11434
```

- **Model**: `nomic-embed-text` (768d, free, local)
- **Model**: `mxbai-embed-large` (1024d, free, local)
- **Model**: `all-minilm` (384d, free, local)
- **Dims**: auto-probed on startup (or falls back to known defaults)

### Disabled (default)

If `HUB_EMBEDDER_PROVIDER` is empty, semantic search falls back to keyword search.

## Data Flow

### 1. Item Ingestion (Pull Time)

When a feed is pulled and new items are saved:

```
Feed Items
    |
    v
Embedder.Embed(["title content", ...])  <-- batch call
    |
    v
[vector1, vector2, ...]
    |
    v
Store.BatchCreateItemsIgnore({..., Embedding: blob})
    |
    v
items.embedding BLOB/bytea
```

### 2. Search Time

```
Query: "AI 编程助手"
    |
    v
Embedder.Embed(["AI 编程助手"])
    |
    v
queryVector [1536]float32
    |
    v
Store.SearchItemsSemantic(queryVector, limit)
    |
    v
Scan all items with embedding != NULL
Compute cosine similarity
Sort by similarity DESC
Return top N
```

## Database Schema

### SQLite

```sql
ALTER TABLE items ADD COLUMN embedding BLOB;
-- BLOB stores little-endian float32 array
```

### PostgreSQL

```sql
ALTER TABLE items ADD COLUMN embedding BYTEA;
-- BYTEA stores little-endian float32 array
```

## Vector Serialization

```go
// Encode: []float32 → []byte (little-endian)
func EncodeFloat32(v []float32) []byte

// Decode: []byte → []float32 (little-endian)
func DecodeFloat32(buf []byte) []float32
```

## Cosine Similarity

```go
func CosineSimilarity(a, b []float32) float64
// Returns [-1, 1]; higher = more similar
// Typical threshold for "related": > 0.75
```

## Hybrid Search Algorithm

1. Run keyword FTS search → `keywordResults`
2. Run semantic vector search → `semanticResults`
3. Merge: add semantic results first (higher precision), then keyword results
4. Deduplicate by item ID
5. Return top N

## Performance Notes

| Data Size | Search Latency | Optimization |
|-----------|---------------|--------------|
| < 1,000 items | < 50ms | Full scan in Go (current) |
| < 10,000 items | < 200ms | Full scan in Go |
| > 10,000 items | Needs optimization | Add HNSW index (pgvector) or sqlite-vec |

Current implementation scans all items with embeddings in Go. This is acceptable for personal RSS readers (typically < 5,000 items). For larger datasets, consider:

- **PostgreSQL**: `pgvector` extension with HNSW index
- **SQLite**: `sqlite-vec` extension with vector index

## API Response

```json
{
  "data": {
    "feeds": [...],
    "items": [...],
    "mode": "hybrid"
  }
}
```

## Configuration Reference

| Env Var | Default | Description |
|---------|---------|-------------|
| `HUB_EMBEDDER_PROVIDER` | — | `openai`, `ollama`, or empty (disabled) |
| `HUB_EMBEDDER_MODEL` | provider-specific | Model name |
| `HUB_EMBEDDER_BASE_URL` | provider-specific | API endpoint |
| `HUB_EMBEDDER_API_KEY` | — | API key (required for OpenAI) |
