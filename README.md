# Innate Hub

A unified feed reader that combines **RSS/Atom feeds** with **TrendRadar hot-news** in a single interface. Built on Fusion's solid foundation with an adapter layer for pluggable feed sources.

## Features

- **RSS/Atom Reader** — Subscribe, group, and read RSS feeds (from Fusion)
- **TrendRadar Integration** — Hot news from Zhihu, Weibo, Baidu, Douyin, etc. auto-synced
- **Semantic Search** — AI-powered vector search across all content (OpenAI or Ollama)
- **Hybrid Search** — Keyword + semantic search combined for best recall & precision
- **Bookmarking** — Save articles for later reading
- **Fever API** — Compatible with Reeder, Unread, FeedMe, etc.
- **Dual Database** — SQLite (default, zero-config) or PostgreSQL (for cloud/InsForge)
- **Pluggable Adapters** — Easy to add new feed sources (see `internal/adapter/`)

## Quick Start

### Docker (Recommended)

**一键启动脚本：**

```bash
cd innate-hub
./docker-start.sh        # SQLite 模式（默认）
./docker-start.sh postgres  # PostgreSQL 模式
```

脚本会自动：检测 Docker、创建 `.env`（交互式配置密码和语义搜索）、检测 TrendRadar 数据、构建镜像、等待健康检查、输出访问地址。

**手动启动（如果你更喜欢）：**

```bash
cd innate-hub
cp .env.example .env
# 编辑 .env，至少设置 HUB_PASSWORD

docker-compose --profile sqlite up -d     # SQLite 模式
docker-compose --profile postgres up -d   # PostgreSQL 模式
```

**脚本命令速查：**

| 命令 | 说明 |
|------|------|
| `./docker-start.sh` | 一键启动（SQLite） |
| `./docker-start.sh postgres` | 一键启动（PostgreSQL） |
| `./docker-start.sh stop` | 停止所有服务 |
| `./docker-start.sh down` | 停止并删除数据卷 |
| `./docker-start.sh logs` | 实时查看日志 |
| `./docker-start.sh update` | 重新构建并重启 |

### Run Locally (SQLite / PostgreSQL / InsForge)

**Requirements:** Go 1.26+, Node.js 20+, pnpm

**一键启动脚本：**

```bash
cd innate-hub
./start.sh              # 同时启动后端 + 前端（前台）
./start.sh -d           # 后台模式
./start.sh backend      # 只启动后端
./start.sh frontend     # 只启动前端
./start.sh stop         # 停止所有服务
./start.sh status       # 查看运行状态
./start.sh logs         # 查看日志
```

脚本会自动：检查依赖、创建 `.env`（交互式配置数据库/密码/语义搜索）、安装前端依赖、启动服务、等待后端就绪。

**数据库模式自动检测**（由 `.env` 中的 `HUB_DB_PATH` 决定）：

| 模式 | HUB_DB_PATH 值 | 说明 |
|------|---------------|------|
| SQLite | `hub.db` | 零配置，默认 |
| PostgreSQL | `postgres://...` | 自托管或云数据库 |
| InsForge | InsForge 提供的 URL | 本地运行 + 云端 PostgreSQL |

**手动启动（如果你更喜欢）：**

```bash
# 后端
cd innate-hub/backend
cp .env.example .env
# 编辑 .env，设置 HUB_PASSWORD 和 HUB_DB_PATH
go run ./cmd/hub

# 前端（另开终端）
cd ../frontend
pnpm install
pnpm dev
```

### Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `HUB_PASSWORD` | — | **Yes** | Login password |
| `HUB_PORT` | `8080` | No | HTTP port |
| `HUB_DB_PATH` | `hub.db` | No | SQLite path or `postgres://...` DSN |
| `TRENDRADAR_DATA_DIR` | `TrendRadar/output/news` | No | TrendRadar SQLite directory |
| `HUB_EMBEDDER_PROVIDER` | — | No | `openai`, `ollama`, or empty |
| `HUB_EMBEDDER_MODEL` | — | No | Model name (provider-specific) |
| `HUB_EMBEDDER_API_KEY` | — | No | API key (required for OpenAI) |
| `HUB_EMBEDDER_BASE_URL` | — | No | API base URL (optional) |
| `FUSION_OIDC_ISSUER` | — | No | OIDC provider URL (e.g. Google, Authelia) |
| `FUSION_OIDC_CLIENT_ID` | — | No | OAuth2 client ID |
| `FUSION_OIDC_CLIENT_SECRET` | — | No | OAuth2 client secret |
| `FUSION_OIDC_REDIRECT_URI` | — | No | Callback URL (e.g. `http://localhost:8080/api/oidc/callback`) |
| `FUSION_OIDC_ALLOWED_USER` | — | No | Restrict login to specific email/sub |

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
- Set `HUB_PASSWORD` in `.env`
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
export HUB_PASSWORD=changeme
# If you want absolute feed links to work behind a domain, also set:
# export FUSION_PUBLIC_URL=https://hub.example.com

docker compose --profile stack up -d
```

Then:

- **Fusion UI**: <http://localhost:8081> — log in with `HUB_PASSWORD`
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
