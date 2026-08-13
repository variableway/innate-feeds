# Data Update Workflow

Innate Feeds supports **both** API mode and static (GitHub Pages) mode. They share the same sync scripts. The browser always tries GitHub live for digest freshness and READMEs; synced files are the snapshot / fallback.

## Two modes (same data, different serving)

| | API mode (`bun run dev` / `bun run start`) | Static mode (`VITE_STATIC_MODE=true`) |
|---|---|---|
| Feeds (trending / starred) | SQLite via `/api/feeds` | `frontend/public/data/` JSON chunks |
| Digest (90-day archive) | `~/.innate/digest/` **or** `frontend/public/data/digest.json` | `digest.json` in the Pages build |
| Digest (latest issues) | Browser live-fetches GitHub Issues and **merges** onto the snapshot | Same |
| README if file exists | API returns `./readmes/{owner}/{repo}.md` immediately, then **refreshes from GitHub** in the background | Browser live-fetches GitHub; bundled `/data/readmes/` is the fallback if GitHub fails |
| How to publish | Not required | Sync → export into this repo → `bun run build:static` |

Typical Pages path: run a window (or daily) sync in this repo, export JSON, then static-build. The site still talks to GitHub from the visitor’s browser so the snapshot is not the only source.

## Database location

- Default local DB: `~/.innate/feeds.db`
- Override with `DB_PATH=/path/to/feeds.db`

## What “last 3 months” means

GitHub’s trending page has **no historical API**. A 90-day window therefore does:

1. **Trending** — fetch **current** daily / weekly / monthly lists into SQLite (weekly ≈ last 7 days, monthly ≈ last 30 days). READMEs are prefetched for repos that already appear in **stored snapshots** whose `snapshot_date` is within 90 days.
2. **Starred** — incremental sync of repos you starred in the last 90 days, then prefetch those READMEs.
3. **Digest issues** — `ruanyf/weekly` and `GitHubDaily/GitHubDaily` issues **created** in the last 90 days, written to `~/.innate/digest/` and `frontend/public/data/digest.json`.

## Commands

Run from repository root (`gh auth login` required).

### Daily (light)

```bash
bun run data:update
```

1. Today’s daily trending + starred last 24h  
2. Digest issues created in the last 90 days  
3. Export chunks + `digest.json` (+ copy `./readmes` into `frontend/public/data/readmes` if present)

### Last ~3 months (bootstrap / deep refresh)

```bash
bun run data:update:window
# equivalent: bun run data:sync:window && bun run data:export
```

Default `--days 90`. Useful flags:

```bash
cd backend
bun run sync:window -- --days 90
bun run sync:window -- --days 90 --skip-readme
bun run sync:window -- --force          # refetch READMEs even if cached this week
bun run sync:window -- --skip-trending --skip-starred   # digest + READMEs only
```

Batch README prefetch skips files fetched in the last 7 days unless `--force`. Opening a repo in the UI still live-fetches.

### Static GitHub Pages build

```bash
bun run data:update:window   # or data:update
bun run build:static
# project pages:
VITE_BASE_PATH=/your-repo bun run build:pages
```

### Pieces

| Script | What it does |
|---|---|
| `bun run data:sync:trending` | Daily + weekly + monthly trending now |
| `bun run data:sync:starred` | Starred since DB watermark |
| `bun run data:sync:starred:recent` | Starred last 24h |
| `bun run data:sync:digest` | Digest issues created in last 90 days |
| `bun run data:sync:window` | All of the 90-day window including README prefetch |
| `bun run data:export` | Incremental JSON + `digest.json` + copy README cache |
| `bun run data:stats` | SQLite stats |

## Static data layout

- `frontend/public/data/manifest.json`: chunk index
- `frontend/public/data/chunks/trending/<YYYY-MM-DD>.json`
- `frontend/public/data/chunks/starred/<YYYY-MM-DD>.json`
- `frontend/public/data/{stats,languages,dates}.json`
- `frontend/public/data/digest.json`: 90-day issues snapshot (**commit this**)
- `frontend/public/data/readmes/{owner}/{repo}.md`: README snapshot (**gitignored**; rebuilt on sync/export, included in the Pages artifact)

On-demand API cache stays at project `./readmes/` (also gitignored).

## GitHub Pages workflow

`.github/workflows/deploy.yml` builds the static site and deploys it.

| Trigger | Sync |
|---|---|
| Daily cron (08:00 UTC) | **90-day window** (trending now, starred, digest issues, README prefetch) |
| **Run workflow** | Choice: `window` (default), `daily`, or `skip` (build committed JSON only). Optional `--days`, skip/force README |
| Push to `main` | Light `data:update` (today’s trending, starred 24h, digest 90d) so code deploys stay fast |

README files are gitignored; CI restores them from Actions cache, refreshes, and Vite copies `frontend/public/data/readmes/` into the Pages artifact.

Optional repo settings:

| Name | Type | Purpose |
|---|---|---|
| `STARRED_USERNAME` | variable | GitHub login whose **public** stars to sync (recommended in CI) |
| `SYNC_GITHUB_TOKEN` | secret | PAT with `public_repo` if `github.token` rate-limits or starred needs auth |
| `FIRECRAWL_API_KEY` | secret | Trending scrape; optional, falls back to `gh` |
| `VITE_BASE_PATH` | variable | Project Pages subpath (default `/<repo>/`) |

```bash
gh workflow run "Deploy to GitHub Pages" -f sync_mode=window -f days=90
```

## TypeScript formatting

- `bun run format:ts` — write
- `bun run format:ts:check` — CI check
