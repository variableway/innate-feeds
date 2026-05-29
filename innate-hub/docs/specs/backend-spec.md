# Backend Specification

## Tech Stack

- **Language**: Go 1.26
- **HTTP Framework**: Gin
- **Database**: SQLite (`modernc.org/sqlite`) with WAL mode
- **Feed Parser**: `gofeed` (RSS/Atom)
- **Migrations**: Embedded SQL files, version-tracked via `schema_migrations` table

## Module Layout

```
backend/
├── cmd/hub/main.go              # Entry point, adapter registration, auto-create trendradar feed
├── internal/
│   ├── adapter/
│   │   ├── adapter.go           # Interface + Result type
│   │   ├── registry.go          # Adapter registry
│   │   ├── rss/                 # RSS/Atom adapter
│   │   └── trendradar/          # TrendRadar SQLite adapter
│   ├── auth/                    # Password + OIDC
│   ├── config/                  # Env-based config
│   ├── handler/                 # Gin handlers + middleware + Fever API
│   ├── model/                   # Data models (Feed, Item, Group, Bookmark)
│   ├── pkg/httpc/               # HTTP client + SSRF guards
│   ├── pull/                    # Pull scheduler + registry-based fetch
│   ├── pullpolicy/              # Scheduling policy (backoff, intervals)
│   └── store/                   # SQL persistence + migrations
```

## Database Schema

See migration files:
- `001_initial.sql` — groups, feeds, items, bookmarks, FTS
- `002_feed_fetch_state.sql` — Runtime fetch metadata
- `003_feed_source_type.sql` — `source_type` column for adapters

## API Endpoints

Base path: `/api`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /sessions | Public | Login |
| DELETE | /sessions | Public | Logout |
| GET | /groups | Yes | List groups |
| POST | /groups | Yes | Create group |
| GET | /feeds | Yes | List feeds (includes source_type) |
| POST | /feeds | Yes | Create feed |
| POST | /feeds/refresh | Yes | Refresh all feeds |
| GET | /items | Yes | List items |
| PATCH | /items/-/read | Yes | Mark items read |
| GET | /search | Yes | Search items |
| GET | /bookmarks | Yes | List bookmarks |
| POST | /bookmarks | Yes | Create bookmark |
| POST | /fever | Yes | Fever API compatibility |

## Startup Sequence

1. Load config from env
2. Open SQLite database + run migrations
3. Build adapter registry (RSS + TrendRadar)
4. Auto-create TrendRadar feed if missing
5. Start HTTP server + pull scheduler
