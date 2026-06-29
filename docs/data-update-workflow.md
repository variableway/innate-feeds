# Data Update Workflow

This project supports updating feed data locally, then exporting static JSON for GitHub Pages deployment.

## Database location

- Default local DB: `~/.innate/feeds.db`
- Override with `DB_PATH=/path/to/feeds.db`

## Common commands

Run from repository root:

- `bun run data:sync:trending`
  - Sync trending data (daily/weekly/monthly snapshots).
- `bun run data:sync:starred`
  - Full incremental starred sync based on DB watermark.
- `bun run data:sync:starred:recent`
  - Sync only recent starred updates (`--days 1`).
- `bun run data:stats`
  - Show DB statistics.
- `bun run data:export`
  - Export JSON to `frontend/public/data/*.json`.
- `bun run data:update`
  - One-shot update pipeline for automation:
    1) sync trending
    2) sync recent starred
    3) export static JSON

## Suggested schedule usage (local AI Agent / cron / launchd)

If you use a local scheduler, run:

```bash
bun run data:update
```

Then optionally trigger deployment:

```bash
gh workflow run "Deploy to GitHub Pages"
```

This keeps data refresh and deployment decoupled.

## TypeScript formatting

- `bun run format:ts`
  - Format TypeScript files in `backend/src` and `frontend/src`.
- `bun run format:ts:check`
  - Check formatting without changing files (good for CI/local checks).
