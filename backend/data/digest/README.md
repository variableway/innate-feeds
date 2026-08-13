# Issues digest local dumps

JSON archives written by `bun run sync:digest` / `bun run export:digest-local`.

Default path is `~/.innate/digest/`; this directory is an optional in-repo copy via `--out ./data/digest`.

```bash
cd backend
bun run sync:digest -- --since 2026-08-01
bun run sync:digest -- --since 2026-08-01 --until 2026-09-01 --created-only --out ./data/digest
```

`*.json` here is gitignored.
