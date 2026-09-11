# DSH Plugin Directory (unused)

The live plugin browser is now the Vite/TanStack app at `/dsh`. This Next.js directory is kept only as a prototype.

A Next.js directory site for the [awesome-dsh-plugin](../awesome/awesome-dsh-plugin) list — browse, search and filter all [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugins.

Built by combining:

- **Data**: [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) — `data/plugins/*.yml` + `stars.json` / `screenshots.json` / `added-dates.json`
- **Architecture**: [openalternative](https://github.com/piotrkulpinski/openalternative) — Prisma-backed directory, nuqs URL-driven filters, server-component data access (rebuilt fresh; not a fork)

## Stack

- Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui
- Prisma 7 + Postgres (driver adapter `@prisma/adapter-pg`)
- nuqs (URL search params) · marked (markdown) · next-themes

## Setup

```bash
bun install

# 1. Postgres: local Prisma dev server (default local store).
#    The named server "dsh-plugins" persists its data AND its port (51214)
#    across restarts — start it once, data survives reboots.
bun run db:start                           # = prisma dev -n dsh-plugins -d
cp .env.example .env                       # DATABASE_URL already points at it

# 2. Migrate + import the plugin data
bunx prisma migrate dev
bun scripts/import-dsh-plugins.ts        # dry-run report (no DB writes)
bun scripts/import-dsh-plugins.ts --apply

# 3. Run
bun run dev                              # http://localhost:3000
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` / `build` / `start` | Next.js dev / production build / serve |
| `bun run db:start` / `db:stop` / `db:status` | Manage the local Prisma dev Postgres (named `dsh-plugins`, persistent) |
| `bun scripts/import-dsh-plugins.ts [--apply] [--limit N] [--data-dir PATH]` | Import/refresh plugins from awesome-dsh-plugin data (dry-run by default; upserts, idempotent) |
| `bunx prisma migrate dev` | Apply schema migrations |
| `bunx tsc --noEmit` | Typecheck |

## Pages

- `/` — searchable/filterable/sortable plugin listing (`?q=&category=&sort=&page=`)
- `/plugins/[slug]` — plugin detail: install command, screenshots, links, related plugins
- `/categories`, `/categories/[slug]` — the 20 awesome-dsh-plugin categories

## Docs

- [docs/awesome-import-spec.md](docs/awesome-import-spec.md) — 把任意 awesome 列表（如 awesome-github）转换成本站可导入的 `awesome.json` 格式规范，以及 "fetch README → AI 解析 → 校验 → 导入" 的 plugin 模式流水线与完整示例。

## Notes

- Import is idempotent (upsert keyed on `sourceUrl`); re-run after the awesome list updates.
- The DB is the default local store: a named Prisma dev Postgres (`dsh-plugins`). Data and port (51214) persist across restarts/reboots; if stopped, restart with `bun run db:start`. Point `DATABASE_URL` elsewhere to use another Postgres.
- Not affiliated with DeepSeek. Plugins are third-party code — review before installing.
