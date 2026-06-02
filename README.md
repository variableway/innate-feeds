# innate-feeds

A plugin-based feed aggregator. Source plugins (RSS, TrendRadar, GitHub Trending,
Product Hunt, remote Fusion, ...) pull content into a unified store; the aggregator
re-emits everything as standard **RSS 2.0 / Atom 1.0 / JSON Feed 1.1** so any
reader — Fusion, NetNewsWire, Reeder, Unread — can subscribe.

```
 ┌─────────────────────────── source plugins ──────────────────────────┐
 │  rss  ·  trendradar  ·  githubtrending  ·  producthunt  ·  fusion  │
 └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌───────────────────────────────┐
              │   SQLite / PostgreSQL store   │  groups, feeds, items,
              │  (PostgreSQL uses pgvector)   │  bookmarks, sessions
              └───────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
   REST / JSON API        RSS / Atom / JSON Feed        Fever API
   (own UI, optional)     (Fusion, any reader)         (mobile clients)
```

## Quick start — pick your path

| Path | When | Command |
|---|---|---|
| **SQLite** | Dev, single-user, small library | `./docker-start.sh` |
| **PostgreSQL + pgvector** | Production, large library, semantic search at scale | `./docker-start.sh postgres` |
| **InsForge** | Self-hosted BaaS-style Postgres (with Studio UI) | `./docker-start.sh insforge` |
| **Full stack** | innate-hub + Fusion UI side-by-side | `./docker-start.sh stack` |
| **Local (no Docker)** | You're on a machine with Go + Node already | `./start.sh` |

The first time you run any of these, the script will ask for a password
and (optionally) an embedder provider. The answers go into a fresh `.env`.

After startup:

- **Hub UI / API**: <http://localhost:8080>
- **Output feeds** (any reader): <http://localhost:8080/all/rss.xml>
- **Fusion UI** (stack profile only): <http://localhost:8081>

## Install with Docker (recommended)

```bash
git clone <this-repo> innate-feeds
cd innate-feeds

# Pick one:
./docker-start.sh             # SQLite
./docker-start.sh postgres    # PostgreSQL + pgvector
./docker-start.sh insforge    # Self-host InsForge-compatible Postgres
./docker-start.sh stack       # innate-hub + Fusion UI
```

The script:

1. Detects Docker and Docker Compose.
2. Creates `.env` from `.env.example` if missing.
3. Asks for a password and (optionally) OpenAI/Ollama API keys.
4. Builds the hub image.
5. Brings the chosen profile up.
6. Waits for the health check.
7. Prints the URLs.

Stop with `./docker-start.sh stop`. Wipe data with `./docker-start.sh down`.

### InsForge in detail

[InsForge](https://insforge.dev) is a self-hostable Firebase alternative
with a Postgres + Studio UI under the hood. innate-feeds treats InsForge
as just another Postgres (the `insforge` profile runs the same
`pgvector/pgvector:pg16` image InsForge bundles).

**Local self-hosted InsForge** via this repo:

```bash
./docker-start.sh insforge
# Hub:      http://localhost:8080
# Postgres: localhost:5432  (postgres / postgres)
```

**Cloud InsForge** (their managed offering):

1. Sign up at <https://insforge.dev> and create a project.
2. Copy the connection string from the InsForge dashboard.
3. Set it in `.env`:
   ```env
   FUSION_DB_PATH=postgres://user:pass@your-insforge-host:5432/dbname?sslmode=require
   ```
4. Run `./start.sh` (or `./docker-start.sh sqlite` and let the hub talk
   to the cloud InsForge over the network — the `sqlite` profile is
   only for the hub's own container; the database can be anywhere).

The Hub automatically:

- Creates the `vector` extension on startup.
- Adds an `embedding_vec vector(N)` column.
- Creates an HNSW index for fast similarity search.

## Install without Docker

Requirements: **Go 1.22+**, **Node.js 20+**, **pnpm** (auto-installed via corepack).

```bash
git clone <this-repo> innate-feeds
cd innate-feeds

./start.sh              # Start backend + frontend (foreground)
./start.sh -d           # Daemon mode
./start.sh backend      # Backend only
./start.sh status       # Check status
./start.sh doctor       # Sanity-check the install
./start.sh logs         # Tail logs
./start.sh stop         # Stop everything
```

`start.sh` reuses the same `.env` and the same profile selection as
`docker-start.sh`. Pick your database, password, and embedder once; the
script remembers.

## Environment Variables

The canonical names are `FUSION_*`. `HUB_*` is accepted as an alias for
backward compatibility.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `FUSION_PASSWORD` (or `HUB_PASSWORD`) | — | yes (or set `FUSION_ALLOW_EMPTY_PASSWORD=true`) | Login password |
| `FUSION_PORT` (or `HUB_PORT`) | `8080` | no | HTTP port |
| `FUSION_DB_PATH` (or `HUB_DB_PATH`) | `hub.db` | no | SQLite file or `postgres://...` DSN |
| `TRENDRADAR_DATA_DIR` | `TrendRadar/output/news` | no | TrendRadar SQLite directory |
| `FUSION_PUBLIC_URL` | _(auto from request)_ | no | Absolute base URL for feed self-links |
| `HUB_EMBEDDER_PROVIDER` | _(disabled)_ | no | `openai`, `ollama`, or empty |
| `HUB_EMBEDDER_MODEL` | _(auto)_ | no | Embedder model name |
| `HUB_EMBEDDER_API_KEY` | — | required for OpenAI | API key |
| `HUB_EMBEDDER_BASE_URL` | _(provider default)_ | no | Embedder endpoint |
| `HUB_EMBEDDER_DIMENSIONS` | _(auto from model)_ | no | Vector size; must match the column dim if you change it |
| `FUSION_SOURCES_JSON` | — | no | JSON array of remote Fusion sources to pull from |
| `FUSION_OIDC_ISSUER` | — | no | OIDC provider URL |
| `FUSION_OIDC_CLIENT_ID` / `FUSION_OIDC_CLIENT_SECRET` | — | no | OIDC credentials |
| `FUSION_OIDC_REDIRECT_URI` | — | required with OIDC | e.g. `http://localhost:8080/api/oidc/callback` |
| `FUSION_OIDC_ALLOWED_USER` | — | no | Restrict to a single identity |
| `FUSION_CORS_ALLOWED_ORIGINS` | _(allow all)_ | no | Comma-separated Origins |
| `FUSION_TRUSTED_PROXIES` | _(none)_ | no | Comma-separated CIDRs |
| `FUSION_ALLOW_PRIVATE_FEEDS` | `false` | no | Allow `localhost` / private IP feed URLs |
| `FUSION_LOG_LEVEL` | `INFO` | no | `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `FUSION_LOG_FORMAT` | `auto` | no | `text`, `json`, or `auto` |

See `.env.example` for the full file with comments.

## Plugin Coverage

| Adapter | Source | In repo? | Status |
|---|---|---|---|
| `rss` | Standard RSS/Atom (HTTP) | yes | shipped |
| `trendradar` | TrendRadar daily SQLite | yes | shipped |
| `githubtrending` | GitHub Trending page | yes | shipped |
| `producthunt` | Product Hunt GraphQL | yes | shipped |
| `fusion` | Remote Fusion /fever | yes | shipped (Stage 2) |

Backlog for future plugins: Hacker News, Lobsters, YouTube channels,
Mastodon timelines, Bluesky feeds, X/Twitter lists, podcast feeds.

## Output Feeds (RSS / Atom / JSON Feed)

Every feed, every group, and the global timeline can be subscribed to as a
standard feed from any RSS reader (Fusion, NetNewsWire, Reeder, Unread, ...).
These endpoints are **public and unauthenticated** by design — they are
consumed by external readers.

| URL | Format |
|---|---|
| `GET /feeds/:id/rss.xml`   | RSS 2.0 (one feed) |
| `GET /feeds/:id/atom.xml`  | Atom 1.0 |
| `GET /feeds/:id/feed.json` | JSON Feed 1.1 |
| `GET /groups/:id/rss.xml`  | RSS 2.0 (all feeds in a group) |
| `GET /groups/:id/atom.xml` | Atom 1.0 |
| `GET /groups/:id/feed.json` | JSON Feed 1.1 |
| `GET /all/rss.xml`         | RSS 2.0 (every item, all feeds) |
| `GET /all/atom.xml`        | Atom 1.0 |
| `GET /all/feed.json`       | JSON Feed 1.1 |

All endpoints support:

- `?unread=1` — only unread items
- `?limit=N` — at most N items (default 50, max 500)
- `If-None-Match` — sends `304 Not Modified` when the ETag matches

The server emits `Cache-Control: public, max-age=60` and an `ETag` derived
from the latest `pub_date` so readers can be polite about re-fetching.

**Public URL.** Absolute links in the rendered feeds (e.g. the `<link rel="self">`)
are built from `FUSION_PUBLIC_URL` when set; otherwise the server derives the
base URL from the request (`X-Forwarded-Proto` / `X-Forwarded-Host` or
`Host` header).

**Example:**

```bash
curl http://localhost:8080/feeds/1/rss.xml
curl http://localhost:8080/all/atom.xml
curl http://localhost:8080/all/feed.json
```

To subscribe in Fusion, add a feed pointing at
`http://localhost:8080/all/rss.xml` — Fusion sees the unified timeline.

## Authentication

Innate Hub supports three authentication methods:

### 1. Password Authentication (default)
- Set `FUSION_PASSWORD` in `.env` (or `HUB_PASSWORD` for back-compat)
- Login via Web UI or POST `/api/sessions`
- Session cookies are **persisted to database** (survives server restarts)

### 2. OIDC / SSO
- Configure any OIDC provider (Google, GitHub, Authelia, Keycloak, etc.)
- Set `FUSION_OIDC_ISSUER`, `FUSION_OIDC_CLIENT_ID`, `FUSION_OIDC_CLIENT_SECRET`, `FUSION_OIDC_REDIRECT_URI`
- Optional: `FUSION_OIDC_ALLOWED_USER` to restrict to a single user
- Users login via `/api/oidc/login` → provider → `/api/oidc/callback`

### 3. API Key (for programmatic access)
- Create API keys via `POST /api/api-keys` (authenticated)
- Use `X-API-Key: <key>` header for all API requests
- Ideal for: third-party integrations, InsForge webhooks, CLI tools
- Keys are stored as bcrypt hashes; the plaintext is shown only once at creation

**API Key endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/api-keys` | List all keys |
| POST | `/api/api-keys` | Create new key (returns plaintext once) |
| DELETE | `/api/api-keys/:id` | Revoke a key |

## Databases: SQLite & PostgreSQL

The driver is auto-detected from `FUSION_DB_PATH`:

| `FUSION_DB_PATH` | Driver | Vector search |
|---|---|---|
| `hub.db` (or any non-`postgres://` path) | SQLite (`modernc.org/sqlite`) | in-Go brute force |
| `postgres://user:pass@host:5432/db` | PostgreSQL (`pgx/v5`) | native pgvector `<=>` operator + HNSW index |

Pick SQLite for zero-config local development and small libraries. Pick
PostgreSQL when you have more than ~10k items, want full-text and vector
search at scale, or want to back up to a managed service.

### Switching to PostgreSQL with pgvector

The bundled `docker-compose.yml` `postgres` profile uses
[`pgvector/pgvector:pg16`](https://github.com/pgvector/pgvector) — no
manual extension install required. The server enables `CREATE EXTENSION
vector` at startup.

For a self-hosted PostgreSQL without the pgvector image, install the
extension once:

```sql
-- As a superuser, on the hub database:
CREATE EXTENSION IF NOT EXISTS vector;
```

Without pgvector, the server logs a warning at startup and falls back to
the in-Go brute-force path. Semantic search still works; it just doesn't
scale.

### Customizing the vector size

`HUB_EMBEDDER_DIMENSIONS` controls the size of the `items.embedding_vec`
column. Default is auto-detected from the embedder model name
(`text-embedding-3-small` → 1536, `nomic-embed-text` → 768, etc.).
Override when you use a fine-tuned model or a different provider.

Changing the dim at runtime requires:

```sql
ALTER TABLE items ALTER COLUMN embedding_vec TYPE vector(<NEW_DIM>);
```

## Semantic search

| Backend | Search method | Best for |
|---|---|---|
| SQLite | in-Go cosine similarity over the BLOB column | < ~10k items, dev |
| PostgreSQL + pgvector | `<=>` cosine distance + HNSW index | any scale |

Both paths share the same `SearchItemsSemantic` API. The choice is
transparent to callers.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│              (Fusion sidebar + article reader)              │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API /api
┌──────────────────────────▼──────────────────────────────────┐
│              Go Backend (Gin + SQLite/PostgreSQL)           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ HTTP API    │  │ Adapter     │  │ Semantic Search     │ │
│  │ (Gin)       │  │ Registry    │  │ (OpenAI / Ollama)   │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ RSS Adapter│  │ TrendRadar   │  │ (future)     │       │
│  │ (HTTP)     │  │ Adapter      │  │ Other Source │       │
│  └────────────┘  └──────┬───────┘  └──────────────┘       │
│                         │                                   │
│  TrendRadar ──► SQLite (output/news/*.db)                 │
│  RSS Feeds ──► HTTP fetch                                │
└─────────────────────────────────────────────────────────────┘
```

## Search Modes

The search API supports three modes via the `?mode=` parameter:

| Mode | URL | How it works |
|------|-----|--------------|
| **keyword** | `/api/search?q=AI` | Full-text search (FTS5 / tsvector) |
| **semantic** | `/api/search?q=AI&mode=semantic` | Vector similarity (embedding cosine) |
| **hybrid** | `/api/search?q=AI&mode=hybrid` | Union of both, semantic results first |

## Adding a New Feed Source

1. Implement the `Adapter` interface:

```go
package mysource

import (
    "context"
    "time"
    "github.com/innate/hub/internal/adapter"
    "github.com/innate/hub/internal/model"
)

type Adapter struct{}

func (a *Adapter) Name() string { return "mysource" }

func (a *Adapter) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*adapter.Result, error) {
    // ... fetch data from your source ...
    return &adapter.Result{Items: []model.Item{{...}}}, nil
}
```

2. Register in `cmd/hub/main.go`:

```go
reg.Register(mysource.New())
```

3. Create feeds via API with `"source_type": "mysource"`.

## Documentation

- [`docs/planning.md`](docs/planning.md) — Architecture & design decisions
- [`docs/feeds/README.md`](docs/feeds/README.md) — Feed adapter overview
- [`docs/feeds/trendradar-adapter.md`](docs/feeds/trendradar-adapter.md) — TrendRadar adapter details
- [`docs/specs/backend-spec.md`](docs/specs/backend-spec.md) — Backend API & schema
- [`docs/specs/adapter-spec.md`](docs/specs/adapter-spec.md) — Adapter interface spec
- [`docs/specs/semantic-search.md`](docs/specs/semantic-search.md) — Semantic search spec
- [`docs/specs/frontend-spec.md`](docs/specs/frontend-spec.md) — Frontend overview

## Using Fusion as the Reader UI

The default frontend in this repo is a separate React app. **For most
deployments, you should run Fusion upstream instead** — it is a complete,
polished RSS reader, and it can consume innate-hub's standard feed output
endpoints. The repo's `docker-compose.yml` ships a `stack` profile that
runs both side by side:

```bash
# Set a password for the hub (Fusion inherits it).
export FUSION_PASSWORD=changeme
# If you want absolute feed links to work behind a domain, also set:
# export FUSION_PUBLIC_URL=https://hub.example.com

docker compose --profile stack up -d
```

Then:

- **Fusion UI**: <http://localhost:8081> — log in with `FUSION_PASSWORD`
- **innate-hub API**: <http://localhost:8080> — for direct REST/Fever access

Inside Fusion, add a feed pointing at the innate-hub aggregator:

```
http://hub-stack:8080/all/rss.xml
```

(or `http://innate-hub:8080/all/rss.xml` — the docker network resolves
both). All innate-hub items appear in Fusion's normal reader UI.

You can also subscribe to per-feed or per-group URLs:

```
http://hub-stack:8080/feeds/1/rss.xml
http://hub-stack:8080/groups/1/atom.xml
```

The `stack` profile is the recommended way to use this project. The
`sqlite` and `postgres` profiles only run innate-hub; the React frontend
under `frontend/` is kept for advanced deployments and direct hub control.

## Project Structure

```
innate-hub/
├── backend/                    # Go backend
│   ├── cmd/hub/main.go         # Entry point
│   ├── internal/
│   │   ├── adapter/            # Feed adapter interface + implementations
│   │   │   ├── adapter.go
│   │   │   ├── registry.go
│   │   │   ├── rss/
│   │   │   └── trendradar/
│   │   ├── embedder/           # Semantic search embedders
│   │   │   ├── embedder.go
│   │   │   ├── openai.go
│   │   │   └── ollama.go
│   │   ├── config/
│   │   ├── handler/            # HTTP handlers
│   │   ├── model/              # Data models
│   │   ├── pull/               # Feed pull scheduler
│   │   ├── store/              # Database layer + migrations
│   │   └── ...
│   ├── Dockerfile
│   └── go.mod
├── frontend/                   # React frontend (from Fusion)
│   ├── src/
│   ├── package.json
│   └── ...
├── docs/                       # Documentation
│   ├── planning.md
│   ├── feeds/
│   └── specs/
├── docker-compose.yml          # SQLite & PostgreSQL profiles
├── .env.example
└── README.md                   # This file
```

## License

MIT (same as Fusion and innate-feeds)
