# AGENTS.md

Workspace guide for `innate-feeds`. This repository contains a web application for discovering and browsing GitHub trending and starred repositories, plus a standalone Go utility for scanning local git repositories.

> **Note for AI agents:** The previous version of this file described an older architecture (`innate-hub`, a Go-based RSS/Atom aggregator). That code is no longer present. The project was reorganized into the TypeScript stack described below. Rely on this file and the actual file tree, not on historical references in `.gitignore` or older commits.

## Project overview

**Innate Feeds** is a full-stack web app that:

- Displays GitHub trending repositories (daily, weekly, monthly snapshots).
- Displays GitHub starred repositories for the authenticated user.
- Supports filtering by language, topic, search term, snapshot date, and sorting by stars / updated / created date.
- Syncs data from GitHub via the `gh` CLI and/or Firecrawl.

The repository also includes `git-repo-scanner/`, a separate Go CLI that recursively scans folders for git repositories and emits JSON/Markdown reports with metadata fetched from GitHub/GitLab APIs.

## Repository layout

```
innate-feeds/
├── backend/                 # Hono API server + CLI + sync logic
│   ├── src/
│   │   ├── server.ts        # Hono HTTP server, API routes
│   │   ├── cli.ts           # Command-line interface for sync/list/stats
│   │   ├── github.ts        # GitHub API / gh CLI wrappers
│   │   ├── sync.ts          # Trending and starred sync orchestration
│   │   ├── firecrawl.ts     # Firecrawl-based GitHub Trending scraper
│   │   └── db/              # SQLite database layer
│   │       ├── index.ts     # Connection, queries, CRUD helpers
│   │       └── schema.sql   # SQLite schema
│   ├── package.json
│   ├── tsconfig.json
│   └── feeds.db*            # Runtime SQLite database (WAL mode)
├── frontend/                # TanStack Router + Vite + React 19 + Tailwind v4
│   ├── src/
│   │   ├── routes/          # Manual TanStack Router route definitions
│   │   ├── components/      # AppSidebar, FeedCard, FilterBar, StatsCards
│   │   ├── services/        # API client (feeds.ts)
│   │   ├── types/           # TypeScript domain types
│   │   ├── lib/             # utils.ts (cn, formatNumber, formatDate)
│   │   ├── main.tsx         # React entry point
│   │   ├── router.tsx       # Route tree assembly
│   │   └── styles.css       # Tailwind CSS v4 theme + dark mode
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── git-repo-scanner/        # Standalone Go CLI (not part of the web app)
│   ├── main.go
│   ├── Makefile
│   ├── go.mod
│   ├── scan-all.sh
│   ├── repos.json           # Sample generated output
│   └── repos.md
├── tasks/                   # Task working directories (mostly empty)
│   └── issues/ui-layout.md  # Historical UI layout requirement note
├── package.json             # Root workspace scripts (uses concurrently)
├── dev.sh                   # Bash helper to start both dev servers
├── README.md
├── CLAUDE.md
└── .env.example             # Legacy env template (not wired to current code)
```

## Technology stack

| Layer | Technology |
|---|---|
| Runtime | Bun / Node.js 18+ |
| Frontend framework | React 19 |
| Routing | TanStack Router (manual route registration, not file-based) |
| Build tool | Vite 6 |
| Styling | Tailwind CSS v4 with CSS-based theme configuration |
| UI utilities | `lucide-react`, `clsx`, `tailwind-merge`, `sonner` (toasts) |
| Backend framework | Hono 4 |
| HTTP server | `@hono/node-server` |
| Database | SQLite via `better-sqlite3` |
| Data fetching | GitHub CLI (`gh`) and Firecrawl |
| Validation | Zod (available, currently used implicitly) |
| Type checking | TypeScript 5.7+ |
| Side utility | Go 1.26.1 (`git-repo-scanner`) |

## Build and development commands

All commands assume you are in the project root unless noted.

### Install dependencies

```bash
# Install root + backend + frontend dependencies
bun install
cd backend && bun install
cd ../frontend && bun install

# Or use the convenience script
bun run install:all
```

### Start development

```bash
# Start backend (http://localhost:4000) and frontend (http://localhost:3000)
bun run dev

# Or use the shell helper
./dev.sh

# Individually
bun run dev:backend   # cd backend && bun run dev
bun run dev:frontend  # cd frontend && bun run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:4000`.

### Sync data from GitHub

These require the `gh` CLI to be installed and authenticated (`gh auth status`).

```bash
# From the repo root
cd backend

# Sync trending repos for all periods
bun run sync:trending

# Sync only daily / weekly / monthly
bun run sync:daily
bun run sync:weekly
bun run sync:monthly

# Sync authenticated user's starred repos
bun run sync:starred

# CLI equivalents
bunx tsx src/cli.ts sync all-trending
bunx tsx src/cli.ts sync trending daily
bunx tsx src/cli.ts sync starred [username]
```

### Other backend CLI commands

```bash
cd backend
bun run list            # List feed items
bun run list:trending   # List trending items
bun run list:starred    # List starred items
bun run dates           # List available trending snapshot dates
bun run stats           # Show database statistics
```

### Frontend build

```bash
cd frontend
bun run dev       # Dev server on port 3000
bun run build     # Production build to frontend/dist/
bun run preview   # Preview production build
```

### Type checking

```bash
cd backend  && bun run typecheck
cd frontend && bun run typecheck
```

### Git repository scanner (Go)

```bash
cd git-repo-scanner
make build

# Scan current directory, skip API calls
./git-repo-scanner . --output repos --skip-api

# Scan with GitHub/GitLab API calls (set GITHUB_TOKEN for higher rate limits)
./git-repo-scanner . --output repos

# Batch scan sibling folders
make scan-all
```

## Runtime architecture

```
┌─────────────────┐      /api/*       ┌─────────────────────────────┐
│  Vite dev server│ ─────────────────> │  Hono server (backend/src/  │
│  port 3000      │   (proxied)        │  server.ts) port 4000       │
└─────────────────┘                    └─────────────────────────────┘
                                                  │
                       ┌──────────────────────────┼──────────────────────────┐
                       ▼                          ▼                          ▼
              better-sqlite3              sync.ts / cli.ts              gh / Firecrawl
              (feeds.db)                  github.ts firecrawl.ts
```

### API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/feeds` | List feed items. Query params: `type` (`trending` or `starred`), `language`, `topic`, `search`, `sort` (`stars`\| `updated`\| `created`), `order` (`asc`\| `desc`), `date`, `page`, `pageSize`. |
| GET | `/api/feeds/stats` | Aggregate stats: total repos, trending count, starred count, top languages. |
| GET | `/api/feeds/languages` | All distinct repository languages. |
| GET | `/api/feeds/dates` | Available trending snapshot dates. |
| POST | `/api/feeds/sync` | Trigger sync. Body: `{ type: "trending" \| "starred" \| "all-trending", period?, username? }`. |

### Sync pipeline

1. **Trending**: `sync.ts` calls `fetchTrendingWithFirecrawl()` first. If Firecrawl returns no results, it falls back to `fetchTrendingRepos()`, which scrapes `https://github.com/trending` via `gh api` and then fetches full repo metadata via the GitHub API.
2. **Starred**: `sync.ts` calls `fetchStarredReposWithDate()`, which paginates through `gh api user/starred` (or `users/{username}/starred`) using the `application/vnd.github.v3.star+json` accept header to obtain `starred_at` timestamps.
3. Both pipelines call `upsertRepo()`, `insertTopics()`, and `insertFeedItem()` inside a single `better-sqlite3` transaction.

## Database

SQLite database file: `backend/feeds.db` (with `-shm` / `-wal` WAL-mode files).

Schema is defined in `backend/src/db/schema.sql`:

- `repos` — repository metadata (stars, forks, language, owner, etc.).
- `feed_items` — individual trending / starred entries keyed by composite IDs such as `trending-{date}-{period}-{repoId}` or `starred-{repoId}`.
- `repo_topics` — many-to-many mapping of repository topics.
- `trending_snapshots` — historical trending snapshot records (currently defined but not written to by the sync code).

The connection is opened lazily via `getDb(dbPath)` and automatically applies the schema, enables WAL mode, and enables foreign keys.

## Code organization and conventions

### TypeScript / general

- **ES modules** everywhere (`"type": "module"` in both `package.json` files).
- **Strict TypeScript** is enabled (`strict: true`).
- **Path alias**: `@/*` maps to `src/*` in the frontend. In the backend, local imports use relative paths with explicit `.js` extensions (e.g., `import { … } from "./db/index.js"`).
- **No test suite** is currently present. There are no `*.test.*`, `*.spec.*`, Vitest, Jest, Playwright, or Cypress configuration files.

### Backend

- `server.ts` — keeps route handlers thin; business logic is delegated to `db/index.ts` and `sync.ts`.
- `cli.ts` — mirrors the sync/list/stats functionality for command-line use.
- `github.ts` — wraps the `gh` CLI with `execSync`. Handles both trending HTML scraping and starred API pagination.
- `firecrawl.ts` — uses the `firecrawl` SDK to scrape GitHub Trending with a JSON extraction schema, then normalizes the result to the `GitHubRepo` interface. Generates deterministic repo IDs from the full name because GitHub Trending pages do not expose numeric IDs.
- `db/index.ts` — all SQL lives here. Uses prepared statements from `better-sqlite3`.

### Frontend

- `router.tsx` manually wires routes (`__root`, `index`, `trending`, `starred`). `index` redirects to `/trending`.
- Route components (`trending.tsx`, `starred.tsx`) manage their own state with `useState` / `useEffect` / `useCallback` and call `services/feeds.ts`.
- Components use `React.forwardRef` and accept a `className` prop merged via the `cn()` utility.
- `styles.css` defines a Tailwind v4 theme with CSS custom properties and a `.dark` variant.
- `services/feeds.ts` uses the `/api` base path, which Vite proxies to the backend during development.

### Go scanner

- `main.go` is a single-file CLI.
- Recursively walks a folder, detects `.git` directories, parses `.git/config` for `remote "origin"` URLs, and extracts owner/repo via regex for SSH and HTTPS URLs.
- Supports GitHub and GitLab API enrichment. Bitbucket/Gitee/other remotes are classified but not enriched via API.
- Rate-limits itself with a 100 ms sleep between API calls.

## Where to make changes

| If you are… | Go to… |
|---|---|
| Adding or changing API endpoints | `backend/src/server.ts` |
| Changing how repos are fetched from GitHub | `backend/src/github.ts` |
| Changing trending sync behavior or fallback strategy | `backend/src/sync.ts` and `backend/src/firecrawl.ts` |
| Changing the database schema or queries | `backend/src/db/schema.sql` and `backend/src/db/index.ts` |
| Adding new CLI commands | `backend/src/cli.ts` and `backend/package.json` scripts |
| Changing pages / routes | `frontend/src/routes/` and `frontend/src/router.tsx` |
| Changing UI components | `frontend/src/components/` |
| Changing API client | `frontend/src/services/feeds.ts` |
| Changing types shared between frontend and backend concepts | `frontend/src/types/feed.ts` (backend has its own internal types) |
| Changing styling / theme | `frontend/src/styles.css` |
| Updating the git scanner | `git-repo-scanner/main.go` |

## Testing instructions

There is no automated test suite in this project yet. To verify changes manually:

1. Start both dev servers: `bun run dev`.
2. Sync data: `cd backend && bun run sync:trending`.
3. Open `http://localhost:3000` and confirm:
   - Trending list loads and filters/sorts work.
   - Starred list loads after running `bun run sync:starred`.
   - Stats cards reflect the synced data.
   - Pagination works when more than 20 items exist.
4. Run type checks: `cd backend && bun run typecheck` and `cd frontend && bun run typecheck`.

## Security considerations

- The backend enables CORS for all origins (`app.use("/*", cors())`). If deployed publicly, restrict this to known origins.
- No authentication or authorization is implemented on API endpoints.
- The sync endpoints (`POST /api/feeds/sync`) execute external processes (`gh`) and network calls (Firecrawl, GitHub). Do not expose them to untrusted users without protection.
- `github.ts` uses `execSync` with string-interpolated URLs. The inputs come from constants or CLI arguments, but be cautious when adding user-controlled parameters.
- The SQLite database path is controlled by the `DB_PATH` environment variable in CLI mode and defaults to `feeds.db` in API mode. Ensure the database file is not served or committed.
- `.env.example` in the repo root is a leftover from the previous architecture and is **not** read by the current backend. The current app does not require environment variables to run locally, although `PORT` and `DB_PATH` are honored where used.
- `git-repo-scanner` reads `GITHUB_TOKEN` from the environment. Do not log or commit tokens.

## Deployment notes

- No Dockerfile, docker-compose file, or CI/CD configuration is present.
- For production, build the frontend (`cd frontend && bun run build`) and serve the resulting `frontend/dist/` folder. The backend is a single Node/Bun process that can be started with `cd backend && bun run start` (or `tsx src/server.ts`).
- Remember to set `PORT` for the backend and configure the frontend to proxy `/api` to the correct backend URL in production (the current Vite config only proxies in dev).
