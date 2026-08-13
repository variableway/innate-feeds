# Innate Feeds

A full-stack web application for discovering and browsing GitHub trending and starred repositories. Supports dual deployment modes: a traditional API+SQLite backend, or a static GitHub Pages site with pre-exported JSON data.

## Features

- **GitHub Trending** — Browse daily, weekly, and monthly trending repositories with snapshot history.
- **GitHub Starred** — View your starred repositories with `starred_at` timestamps and incremental sync.
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

### Sync Data

```bash
cd backend

# Sync trending repos (all periods: daily, weekly, monthly)
bun run sync:trending

# Sync your starred repos (full)
bun run sync:starred

# Sync only recently starred (last 24h, incremental)
bun run sync:starred:recent

# View stats
bun run stats
```

### Build for Production

**API mode (one process):**
```bash
bun run start
# Website + API at http://localhost:4000
```

**Static mode (GitHub Pages):**
```bash
# Export data + build frontend in static mode
bun run build:static

# For project pages with a sub-path
VITE_BASE_PATH=/your-repo bun run build:pages
```

## Project Structure

```
innate-feeds/
├── backend/
│   └── src/
│       ├── app/          # server.ts (Hono API), cli.ts (CLI)
│       ├── collector/    # github.ts, firecrawl.ts, sync.ts
│       ├── data/         # export/import static JSON
│       └── db/           # SQLite schema, queries, path config
├── frontend/
│   └── src/
│       ├── pages/        # TanStack Router routes (trending, starred)
│       ├── components/   # FeedCard, FilterBar, AppSidebar, etc.
│       ├── services/     # feeds.ts (API + static mode client)
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
| Backend | Hono 4, @hono/node-server |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Data Sources | GitHub CLI (`gh`), Firecrawl |
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

## License

Private project.
