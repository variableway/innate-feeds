# Innate Hub — Planning Document

## Overview

Innate Hub is a unified feed reader that combines:

- **Fusion** (Go backend + React frontend) — RSS/Atom reader with Fever API, bookmarks, search
- **TrendRadar** (Python) — Hot-news aggregator with AI analysis, stored in daily SQLite databases

TrendRadar and Fusion source code are kept untouched in their original directories (`TrendRadar/`, `fusion/`). Innate Hub copies from Fusion and adds:

1. **Adapter layer** for pluggable feed sources
2. **TrendRadar adapter** for hot-news ingestion
3. **Semantic search** with OpenAI / Ollama embeddings
4. **Dual database support** — SQLite (default) and PostgreSQL

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│              (from Fusion — sidebar + reader)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API /api
┌──────────────────────────▼──────────────────────────────────┐
│              Go Backend (from Fusion + extensions)           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Gin HTTP    │  │ Adapter     │  │ Semantic Search     │ │
│  │ API         │  │ Registry    │  │ (OpenAI / Ollama)   │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ RSS Adapter│  │ TrendRadar   │  │ (future)     │       │
│  │ (HTTP)     │  │ Adapter      │  │ Other Source │       │
│  └────────────┘  └──────┬───────┘  └──────────────┘       │
│                         │                                   │
│  TrendRadar (Python) ──► SQLite (output/news/*.db)        │
│  RSS Feeds ──► HTTP fetch                                │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Adapter Pattern**: All feed sources implement `adapter.Adapter` interface. New sources can be plugged in by registering a new adapter.
2. **Unified Storage**: All items (RSS articles + TrendRadar news) land in the same `items` table, consumed by the same frontend.
3. **TrendRadar Auto-Discovery**: On startup, the backend checks if a `trendradar` feed exists; if not, it creates one automatically.
4. **No Frontend Changes**: Fusion's React frontend is reused as-is. TrendRadar news appears as regular feed items.
5. **Semantic Search (Optional)**: AI-powered vector search is completely optional. If no embedder is configured, the system falls back to keyword search seamlessly.
6. **Dual Database**: SQLite for zero-config self-hosting; PostgreSQL for cloud providers like InsForge.

## File Structure

```
innate-hub/
├── backend/
│   ├── cmd/hub/main.go          # Entry point + adapter registration + embedder init
│   └── internal/
│       ├── adapter/
│       │   ├── adapter.go       # Interface definition
│       │   ├── registry.go      # Adapter registry
│       │   ├── rss/             # RSS/Atom adapter
│       │   └── trendradar/      # TrendRadar SQLite adapter
│       ├── embedder/            # Semantic search embedders
│       │   ├── embedder.go      # Interface + vector utils
│       │   ├── openai.go        # OpenAI API embedder
│       │   └── ollama.go        # Ollama local embedder
│       ├── ... (from Fusion)
├── frontend/                     # Copied from Fusion
├── docs/
│   ├── planning.md              # This file
│   ├── feeds/
│   │   ├── README.md
│   │   └── trendradar-adapter.md
│   └── specs/
│       ├── backend-spec.md
│       ├── adapter-spec.md
│       ├── semantic-search.md
│       └── frontend-spec.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HUB_DB_PATH` | `hub.db` | SQLite file or `postgres://` DSN |
| `HUB_PASSWORD` | — | Login password |
| `HUB_PORT` | `8080` | HTTP server port |
| `TRENDRADAR_DATA_DIR` | `TrendRadar/output/news` | TrendRadar SQLite directory |
| `HUB_EMBEDDER_PROVIDER` | — | `openai`, `ollama`, or empty (disabled) |
| `HUB_EMBEDDER_MODEL` | — | Model name |
| `HUB_EMBEDDER_BASE_URL` | — | API base URL |
| `HUB_EMBEDDER_API_KEY` | — | API key (OpenAI only) |

## Database Migrations

| Version | SQLite | PostgreSQL | Description |
|---------|--------|-----------|-------------|
| 001 | ✅ | ✅ | Initial schema (groups, feeds, items, bookmarks, FTS) |
| 002 | ✅ | ✅ | Feed fetch state (runtime metadata) |
| 003 | ✅ | ✅ | Feed source_type (adapter support) |
| 004 | ✅ | ✅ | Item embedding (semantic search) |

## Authentication

Innate Hub implements a multi-layer authentication system:

| Method | Storage | Use Case |
|--------|---------|----------|
| **Password** | bcrypt hash in config | Default login, Web UI |
| **Session Cookie** | Persistent `sessions` table (DB) | Web UI sessions, survives restart |
| **OIDC / SSO** | External provider (Google, Authelia, etc.) | Enterprise / self-hosted SSO |
| **API Key** | bcrypt hash in `api_keys` table | Programmatic access, integrations |

### Session Persistence
Sessions were originally stored in an in-memory map (lost on restart). Migration `005` adds a `sessions` table, and all session operations now go through the database layer. This is critical for production deployments and container restarts.

### API Keys
API keys enable third-party integrations without sharing the main password. The flow:
1. Authenticated user creates a key via `POST /api/api-keys`
2. Server generates `ih_<random>` plaintext, stores bcrypt hash
3. Plaintext is returned **once** — the user must save it
4. Subsequent requests use `X-API-Key: ih_...` header
5. `authMiddleware` checks session cookie first, then falls back to API key validation

## Remaining Work

- [x] Adapter interface + registry
- [x] RSS adapter (wraps Fusion's original fetch)
- [x] TrendRadar adapter (reads SQLite)
- [x] Auto-create TrendRadar feed on startup
- [x] Store schema migration (003_feed_source_type.sql)
- [x] Puller uses registry
- [x] Dual database support (SQLite + PostgreSQL)
- [x] Semantic search (OpenAI + Ollama)
- [x] Hybrid search (keyword + semantic)
- [x] Docker Compose (SQLite + PostgreSQL profiles)
- [x] Session persistence (migration 005)
- [x] API Key authentication
- [ ] Frontend search mode toggle (keyword / semantic / hybrid)
- [ ] Frontend API Key management UI
- [ ] Testing with real TrendRadar data
