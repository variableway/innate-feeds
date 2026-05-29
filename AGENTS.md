# Agents.md — Innate Feeds

## Project Identity

**innate-feeds** is a unified content aggregation platform combining:
- **Innate Hub**: RSS/Atom feed reader + TrendRadar hot news + GitHub Trending + Product Hunt
- **TrendRadar**: Independent Python-based hot-news crawler (Zhihu, Weibo, Baidu, Douyin, etc.)

All trending services (GitHub Trending, GitHub Starred, Product Hunt) have been merged into `innate-hub`.

---

## Repository Structure

```
innate-feeds/
├── innate-hub/                         # Unified feed reader + trending aggregator
│   ├── backend/
│   │   ├── cmd/hub/main.go             # Main server entry (RSS + Trending API)
│   │   ├── cmd/trending-cli/main.go    # CLI tool (fetch / list)
│   │   ├── cmd/trending-tui/main.go    # TUI terminal dashboard
│   │   ├── internal/
│   │   │   ├── handler/                # HTTP handlers (feed + trending)
│   │   │   ├── adapter/                # Pluggable feed sources
│   │   │   │   ├── rss/                # RSS/Atom adapter
│   │   │   │   ├── trendradar/         # TrendRadar SQLite adapter
│   │   │   │   ├── githubtrending/     # GitHub Trending adapter
│   │   │   │   └── producthunt/        # Product Hunt adapter
│   │   │   ├── store/                  # database/sql store (feed data)
│   │   │   └── trending/               # ★ Trending sub-system
│   │   │       ├── pkg/github/         # GitHub API client
│   │   │       ├── pkg/producthunt/    # Product Hunt API client
│   │   │       ├── model/              # GORM models (3 tables)
│   │   │       ├── store/              # GORM store layer
│   │   │       └── service/            # Business logic
│   │   ├── internal/web/dist/          # Embedded frontend build
│   │   └── go.mod
│   ├── frontend/                       # React + TanStack Router + shadcn/ui
│   ├── docs/
│   ├── docker-compose.yml
│   ├── docker-start.sh
│   └── start.sh
│
├── TrendRadar/                         # Independent hot-news crawler (Python)
│   ├── trendradar/                     # Crawler modules
│   ├── output/news/                    # Daily SQLite databases
│   ├── config/
│   └── ...
│
├── data/                               # JSON data exports (legacy)
├── docker-compose.yml                  # Root-level orchestration (legacy)
├── MERGE_SUMMARY.md                    # Trending merge documentation
├── SPEC.md                             # System specification
├── README.md
└── AGENTS.md
```

---

## Innate Hub Backend

**Framework**: Gin + `database/sql` (feed data) + GORM (trending data) + SQLite/PostgreSQL
**Database**: All tables share one database (`fusion.db` or PostgreSQL)

### Interfaces
- **REST API** (`cmd/hub`): Unified server on `:8080` — feeds, items, bookmarks, search, trending
- **CLI** (`cmd/trending-cli`): Cobra commands for `fetch`, `list`
- **TUI** (`cmd/trending-tui`): Bubble Tea interactive terminal UI

### Feed Adapters
| Adapter | SourceType | Description |
|---|---|---|
| `rss` | `rss` | Standard RSS/Atom feeds |
| `trendradar` | `trendradar` | Reads TrendRadar daily SQLite DBs |
| `githubtrending` | `githubtrending` | Scrapes GitHub Trending page |
| `producthunt` | `producthunt` | Product Hunt GraphQL API |

### Trending API Endpoints

Mounted under `/api/trending/*`, protected by innate-hub auth (session / API Key).

| Method | Path | Description |
|---|---|---|
| GET | `/api/trending/stats` | Dashboard stats |
| GET | `/api/trending/github/trending` | List trending repos |
| POST | `/api/trending/github/trending/fetch` | Fetch trending repos |
| GET | `/api/trending/github/trending/languages` | Language list |
| GET | `/api/trending/github/starred/:username` | User's starred repos |
| POST | `/api/trending/github/starred/fetch` | Fetch starred repos |
| GET | `/api/trending/github/starred/:username/languages` | Language breakdown |
| GET | `/api/trending/producthunt` | List Product Hunt products |
| POST | `/api/trending/producthunt/fetch` | Fetch Product Hunt data |
| GET | `/api/trending/producthunt/categories` | Topic categories |

### Feed API Endpoints (Existing)

| Method | Path | Description |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/groups` | Feed groups |
| GET/POST/PATCH/DELETE | `/api/feeds` | Feed sources |
| GET/PATCH | `/api/items` | Feed items (articles) |
| GET | `/api/search` | Full-text + semantic search |
| GET/POST/DELETE | `/api/bookmarks` | Saved items |
| POST | `/fever` | Fever API compatibility |

---

## Innate Hub Frontend

**Framework**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
**Router**: TanStack Router (file-based)
**State**: TanStack Query + Zustand stores
**UI**: next-themes (dark/light), sonner (toasts)

### Routes
| Path | Page |
|---|---|
| `/` | Feed reader (all / unread items) |
| `/feeds` | Feed management |
| `/groups/:groupId` | Group-filtered items |
| `/login` | Login |

Trending content appears naturally in the feed reader via Adapters.

---

## Development Conventions

### Go
- **Stdlib logging**: Use `log/slog`, not third-party loggers
- **Error handling**: Return errors up the stack, wrap with `fmt.Errorf`
- **Feed store**: `database/sql` with named parameters in `internal/store/`
- **Trending store**: GORM in `internal/trending/store/` (bridged from `*sql.DB`)
- **CLI**: Cobra commands in `cmd/trending-cli/`
- **TUI**: Bubble Tea in `cmd/trending-tui/`
- **API**: Gin handlers in `internal/handler/`

### TypeScript / React
- **Framework**: Vite SPA with TanStack Router, no SSR
- **UI components**: shadcn/ui — use `cn()` from `clsx` + `tailwind-merge`
- **Data fetching**: TanStack Query
- **Styling**: Tailwind CSS

### Shared Patterns
- **Environment vars**: `.env` files at project roots
- **GitHub Token**: `GITHUB_TOKEN` env var for higher API rate limits
- **Database**: `FUSION_DB_PATH` (SQLite file or `postgres://` DSN)

---

## Common Commands

```bash
# Main server
cd innate-hub/backend
cp .env.example .env  # if needed
go run ./cmd/hub

# CLI
cd innate-hub/backend
go run ./cmd/trending-cli fetch github-trending --period daily
go run ./cmd/trending-cli list github-starred <username>

# TUI
cd innate-hub/backend
go run ./cmd/trending-tui

# Frontend
cd innate-hub/frontend
pnpm install
pnpm dev

# Docker (Innate Hub)
cd innate-hub
./docker-start.sh
```

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `FUSION_DB_PATH` | `fusion.db` | Database file or PostgreSQL DSN |
| `FUSION_PASSWORD` | — | Hub login password (required) |
| `FUSION_PORT` | `8080` | API server port |
| `GITHUB_TOKEN` | — | GitHub PAT for higher rate limits |
| `PRODUCTHUNT_TOKEN` | — | Product Hunt API token |
| `HUB_EMBEDDER_PROVIDER` | — | Semantic search: `openai` / `ollama` |
| `HUB_EMBEDDER_MODEL` | — | Embedder model name |
| `HUB_EMBEDDER_API_KEY` | — | OpenAI API key |

---

## When Making Changes

1. **Backend changes**: Go to `innate-hub/backend/`
2. **Frontend changes**: Go to `innate-hub/frontend/`
3. **Trending backend**: `innate-hub/backend/internal/trending/`
4. **Docker**: Update `innate-hub/docker-compose.yml`
5. **Docs**: Update `README.md`, `MERGE_SUMMARY.md`, or this file as needed
