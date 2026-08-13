# Innate Feeds

Browse GitHub **trending**, **starred**, and a community **issues digest** (ruanyf/weekly + GitHubDaily). Two serving modes share the same sync scripts:

- **API mode** — Hono + SQLite. Disk cache first, GitHub refresh in the background.
- **Static mode** — GitHub Pages from pre-exported JSON. The browser still fetches GitHub live for digest freshness and READMEs; bundled snapshots are the fallback.

## Tech stack

| Layer | What we use |
|---|---|
| Runtime | [Bun](https://bun.sh/) (HTTP via `Bun.serve`, SQLite via `bun:sqlite`) |
| Language | TypeScript 5.7 (strict, ES modules) |
| Frontend | React 19, TanStack Router, TanStack Table, Vite 6 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), lucide-react, next-themes, sonner |
| Markdown | react-markdown, remark-gfm, rehype-sanitize |
| Backend | [Hono](https://hono.dev/) 4, Zod |
| Database | SQLite (WAL), default `~/.innate/feeds.db` |
| Data ingest | GitHub CLI (`gh`), optional [Firecrawl](https://firecrawl.dev/), public GitHub REST from the browser |
| Tests / format | Vitest, Prettier |
| CI / CD | GitHub Actions — `.github/workflows/ci.yml` + `deploy.yml` |
| Production (public) | GitHub Pages (`actions/upload-pages-artifact` + `actions/deploy-pages`) |
| Production (self-host) | `bun run start` — Vite build served by the Hono process on one origin |

## Features

- **GitHub Trending** — Daily / weekly / monthly snapshots and date filters.
- **GitHub Starred** — `starred_at`, incremental sync, optional custom categories.
- **Issues digest** — 90-day JSON snapshot merged with live GitHub Issues.
- **Repo README** — In-app Markdown. API: `./readmes` then background refresh. Static: live GitHub, then `/data/readmes`.
- **Filters** — Language, topics, snapshot date, stars range, search; sort by stars / updated / created / starred.
- **Themes** — Default, Notion, Linear; filter state in localStorage.

## Quick start

**Prerequisites:** [Bun](https://bun.sh/), [GitHub CLI](https://cli.github.com/) (`gh auth login`). Firecrawl API key is optional.

```bash
git clone <repo-url>
cd innate-feeds
bun install
bun run install:all
bun run dev
```

- API: `http://localhost:4000`
- UI: `http://localhost:3000` (Vite proxies `/api` → `:4000`)

One process (UI + API on the same origin):

```bash
bun run start          # builds frontend, serves frontend/dist + /api
HOST=0.0.0.0 PORT=8080 bun run start
```

### Sync data

```bash
# Light: trending today, starred 24h, digest last 90 days, export JSON
bun run data:update

# ~3 months: current trending, starred since cutoff, digest issues, README prefetch
bun run data:update:window

# Then a local static build (optional)
bun run build:static
```

GitHub Trending has **no historical API**. “Last 3 months trending” means today’s daily/weekly/monthly lists plus READMEs for repos already in stored snapshots. Flags: `--days 90`, `--skip-readme`, `--force`. Details: [docs/data-update-workflow.md](docs/data-update-workflow.md).

---

## DevOps / deployment

### Two production shapes

| | **GitHub Pages (static)** | **Self-host (API)** |
|---|---|---|
| Command | CI `deploy.yml`, or `bun run build:static` | `bun run start` |
| Needs backend at runtime | No | Yes (`Bun.serve` on `HOST`/`PORT`) |
| Data | JSON under `/data/` + live GitHub in the browser | SQLite + `./readmes` + live fallback |
| Typical use | Public site | Private / LAN / VPS |

### CI (every push / PR to `main`)

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

1. Install with Bun  
2. `bun run test` (Vitest)  
3. `tsc --noEmit` on backend and frontend  
4. `bun run format:ts:check` (Prettier)  
5. `bun run build` (frontend)

### GitHub Pages (public site)

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

**One-time GitHub settings**

1. Repo **Settings → Pages → Source: GitHub Actions**.  
2. **Settings → Actions → General** — allow the `pages` + `id-token` permissions this workflow requests.  
3. Recommended variable: `STARRED_USERNAME` (whose **public** stars CI should sync).  
4. Optional: secrets `SYNC_GITHUB_TOKEN` (PAT, `public_repo`), `FIRECRAWL_API_KEY`; variable `VITE_BASE_PATH` (default `/<repo>/` for project Pages).

**What runs**

| Trigger | Data sync | Then |
|---|---|---|
| Daily cron **08:00 UTC** | **90-day window** (trending now, starred, digest, README prefetch) | Commit `frontend/public/data/` (chunks + `digest.json`), build `VITE_STATIC_MODE=true`, deploy Pages |
| **Actions → Deploy to GitHub Pages → Run workflow** | `window` (default), `daily`, or `skip` | Same. Inputs: `days`, `skip_readme`, `force_readme` |
| Push to `main` | Light `data:update` | Build + deploy (no data commit, so code pushes do not loop) |

READMEs under `frontend/public/data/readmes/` are gitignored. CI restores them from Actions cache, refreshes, and Vite copies them into the Pages artifact. The live site still calls `api.github.com` / `raw.githubusercontent.com` from the visitor’s browser.

```bash
# Manual deploy from a laptop (same pipeline as “Run workflow”)
gh workflow run "Deploy to GitHub Pages" -f sync_mode=window -f days=90

# Local static output only (no push)
bun run data:update:window
bun run build:static
# Project Pages subpath:
VITE_BASE_PATH=/your-repo bun run build:pages
```

### Self-host API mode

```bash
bun run install:all
bun run data:update:window   # or data:update
bun run start                # http://localhost:4000  (UI + /api)
```

Bind for a VPS / reverse proxy:

```bash
HOST=0.0.0.0 PORT=8080 bun run start
```

Keep `feeds.db` and `./readmes` off the public web root. Restrict CORS in `backend/src/app/server.ts` before exposing the API to the internet. Do not expose `POST /api/feeds/sync` to untrusted users.

---

## Project structure

```
innate-feeds/
├── backend/src/
│   ├── app/          # server.ts (Hono + Bun.serve), cli.ts
│   ├── collector/    # github, firecrawl, sync, sync-window, digest
│   ├── data/         # export/import JSON, digest snapshot, README cache
│   └── db/           # bun:sqlite schema + queries
├── frontend/src/     # React pages, components, feeds.ts + github-live.ts
├── frontend/public/data/   # static snapshot (manifest, chunks, digest.json)
├── .github/workflows/      # ci.yml, deploy.yml
└── docs/data-update-workflow.md
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API / combined server port |
| `HOST` | localhost | Bind address (`0.0.0.0` for Docker/VPS) |
| `DB_PATH` | `~/.innate/feeds.db` | SQLite file |
| `INNATE_HOME` | `~/.innate` | Data directory (`DB_PATH` overrides) |
| `DIGEST_DIR` | `$INNATE_HOME/digest` | Digest JSON dumps |
| `READMES_DIR` | `./readmes` | README disk cache |
| `VITE_STATIC_MODE` | — | `true` for GitHub Pages / static client |
| `VITE_BASE_PATH` | `/` | Pages project subpath |
| `GH_TOKEN` / `GITHUB_TOKEN` | — | Higher GitHub API limits (`gh` + README fetch) |
| `FIRECRAWL_API_KEY` | — | Optional trending scrape |

## License

Private project.
