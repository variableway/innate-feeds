# Innate Feeds

A full-stack web application for discovering and browsing GitHub trending and starred repositories, plus a community issues digest. Supports dual deployment modes: a traditional API+SQLite backend, or a static GitHub Pages site with pre-exported JSON data. Both modes keep a **snapshot** (SQLite / JSON / `./readmes`) and still **fetch GitHub live** when you open digest items or READMEs.

## Features

- **GitHub Trending** — Browse daily, weekly, and monthly trending repositories with snapshot history.
- **GitHub Starred** — View your starred repositories with `starred_at` timestamps and incremental sync.
- **Issues digest** — ruanyf/weekly and GitHubDaily issue boards; static builds ship a 90-day JSON snapshot and merge live GitHub on top.
- **Repo README** — In-app Markdown. API mode serves `./readmes` then refreshes from GitHub. Static mode live-fetches GitHub and falls back to bundled `/data/readmes`.
- **Filtering & Search** — Filter by language, topics, date snapshot, stars range; search by name/description; sort by stars, updated, created, or starred date.
- **Dual Mode** — Run as a full-stack app (Hono API + SQLite) or deploy as a static site (GitHub Pages) with incremental JSON data chunks.
- **Multi-theme** — Default, Notion, and Linear theme support.
- **Filter Persistence** — Filter state is saved to localStorage and restored on page reload.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) or Node.js 18+
- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated (`gh auth login`)
- [Firecrawl](https://firecrawl.dev/) API key (optional, falls back to `gh` CLI)

### Install

```bash
git clone <repo-url>
cd innate-feeds
bun install
bun run install:all
```

### Development

```bash
bun run dev
```

This starts:
- Backend API at `http://localhost:4000`
- Frontend dev server at `http://localhost:3000` (proxies `/api` to backend)

### Run as one web server

Build the UI, then serve it from the backend (API + website on the same origin):

```bash
bun run start
```

Open `http://localhost:4000`. If `frontend/dist` already exists, you can skip the rebuild with `cd backend && bun run start`.

Override bind address / port:

```bash
HOST=0.0.0.0 PORT=8080 bun run start
```

### Sync data

```bash
# Daily-ish (trending today, starred last 24h, digest last 90 days, export JSON)
bun run data:update

# Last ~3 months: trending now, starred since cutoff, digest issues, README prefetch
bun run data:update:window

# Then static GitHub Pages build
bun run build:static
```

See [docs/data-update-workflow.md](docs/data-update-workflow.md) for flags (`--days 90`, `--skip-readme`, `--force`) and what “3 months trending” means.

### Build for production

**API mode (one process):**
```bash
bun run start
# Website + API at http://localhost:4000
```

**Static mode (GitHub Pages):**
```bash
# After a window or daily sync+export:
bun run build:static

# For project pages with a sub-path
VITE_BASE_PATH=/your-repo bun run build:pages
```

Static mode still calls `api.github.com` / `raw.githubusercontent.com` from the browser for digest freshness and READMEs. Bundled `digest.json` and `/data/readmes/` are fallbacks when GitHub is slow or rate-limited.

The **Deploy to GitHub Pages** workflow runs a **90-day window sync** on the daily cron (and on **Run workflow**, default). Pushes to `main` use the lighter daily update. See [docs/data-update-workflow.md](docs/data-update-workflow.md).

## Project Structure

```
innate-feeds/
├── backend/
│   └── src/
│       ├── app/          # server.ts (Hono API), cli.ts (CLI)
│       ├── collector/    # github.ts, firecrawl.ts, sync.ts, sync-window.ts
│       ├── data/         # export/import static JSON, digest snapshot, README cache
│       └── db/           # SQLite schema, queries, path config
├── frontend/
│   └── src/
│       ├── pages/        # TanStack Router routes (trending, starred, digest)
│       ├── components/   # FeedCard, FilterBar, AppSidebar, etc.
│       ├── services/     # feeds.ts (API + static), github-live.ts (browser GitHub)
│       ├── hooks/        # usePersistedFeedFilters
│       ├── lib/          # utils, theme, filter storage
│       └── types/        # TypeScript domain types
├── git-repo-scanner/     # Standalone Go CLI for scanning local git repos
└── package.json          # Root workspace scripts
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Router, Vite 6, Tailwind CSS v4 |
| Backend | Hono 4, Bun SQLite |
| Database | SQLite (WAL mode) |
| Data Sources | GitHub CLI (`gh`), Firecrawl, public GitHub REST from the browser |
| Validation | Zod |
| Runtime | Bun / Node.js 18+ |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend API server port |
| `DB_PATH` | `~/.innate/feeds.db` | SQLite database file path |
| `INNATE_HOME` | `~/.innate` | Data directory (DB_PATH overrides) |
| `VITE_STATIC_MODE` | — | Set to `true` for static/GitHub Pages mode |
| `VITE_BASE_PATH` | `/` | Base URL path for GitHub Pages project sites |
| `GITHUB_TOKEN` | — | Used by `git-repo-scanner` for higher API rate limits |
| `READMES_DIR` | `./readmes` | On-disk README cache root |

## License

Private project.
