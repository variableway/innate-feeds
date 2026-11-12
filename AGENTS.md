# AGENTS.md

> **项目事实来源：** [`docs/project/index.md`](docs/project/index.md) — spec、issues、多 Agent 交接日志均在该目录。下文为仓库地图与开发命令（L2），新任务请先读 project 文档再动手。

Workspace guide for `innate-feeds`. This repository contains a full-stack web application for discovering and browsing GitHub trending and starred repositories.

## Project overview

**Innate Feeds** is a full-stack web app that:

- Displays GitHub trending repositories (daily, weekly, monthly snapshots).
- Displays GitHub starred repositories for the authenticated user.
- Supports filtering by language, topic, search term, snapshot date, stars range, and sorting by stars / updated / created / starred date.
- Syncs data from GitHub via the `gh` CLI and/or Firecrawl.
- Supports dual deployment modes: API mode (Hono backend + SQLite) and static mode (GitHub Pages with pre-exported JSON data).

## Repository layout

```
innate-feeds/
├── backend/                 # Hono API server + CLI + sync logic + data export/import
│   ├── src/
│   │   ├── app/             # Application entry points
│   │   │   ├── server.ts    # Hono HTTP server, API routes
│   │   │   └── cli.ts       # Command-line interface for sync/list/stats
│   │   ├── collectors/      # Data collection layer（M0 分组：core/external/vertical）
│   │   │   ├── core/        # GitHub 系：github / firecrawl / sync / sync-window / issues-digest / prefetch-readmes / github-topics
│   │   │   ├── external/    # 外部 JSON 源：producthunt / yc / a16z / hackernews / huggingface / github-new / devto / lobsters / trendshift / vc-portfolio
│   │   │   ├── vertical/    # 垂直 topic 源：awesome-dsh / dsh-catalog / edu-skills / edu-videos / edu-videos-bilibili
│   │   │   └── shared/      # Shared collector utilities
│   │   │       ├── types.ts # ExternalFeedItem, FeedCollector interfaces（re-export 根 shared/types）
│   │   │       ├── storage.ts # JSON storage (manifest + saveItems)
│   │   │       └── http.ts  # HTTP utilities (fetchJson, fetchHtml, retry)
│   │   ├── data/            # Static data export/import utilities
│   │   │   ├── export-incremental.ts  # Incremental JSON chunk exporter
│   │   │   ├── export-static.ts       # Full static exporter
│   │   │   ├── import-static.ts       # Import static JSON into SQLite
│   │   │   ├── manifest-utils.ts      # Manifest read/write helpers
│   │   │   ├── hidden-store.ts        # Hidden ("deleted") items store (~/.innate/hidden.json)
│   │   │   ├── topics-store.ts        # GitHub Topics snapshots (~/.innate/github-topics/topics)
│   │   │   ├── export-topics.ts       # topics static export (frontend/public/data/topics)
│   │   │   ├── external-store.ts      # external feed sources store (GH #31, /api/external)
│   │   │   └── export-external.ts     # external sources static export (GH #31)
│   │   ├── dsh/              # DSH plugin catalog datasource (issue #13 抽离)
│   │   │   ├── catalog.ts    # YAML catalog loading + search/sort/pagination
│   │   │   ├── routes.ts     # Hono sub-app: /api/plugins* (mounted by server.ts)
│   │   │   └── export.ts     # plugins.json static export (called by export-incremental)
│   │   └── db/              # SQLite database layer
│   │       ├── index.ts     # Connection, queries, CRUD helpers
│   │       ├── schema.sql   # SQLite schema (trending_repos, starred_repos, topics)
│   │       └── paths.ts     # Database path resolution (INNATE_HOME / DB_PATH)
│   ├── package.json
│   ├── tsconfig.json
│   └── feeds.db*            # Runtime SQLite database (WAL mode)
├── shared/                   # 跨层唯一真相（NOT @innate scope）：types/（feeds/external/topics/plugins wire 契约，S0）· sources/（external 源注册表，S4）· plugin-categories/edu-categories/theme-catalog 常量。边界：纯函数/类型/常量，无 IO/React/Bun 专有 API，不 import backend/frontend/topics
├── frontend/                # @innate/domain-feeds — TanStack domain (track A) + minimal standalone host
│   ├── src/
│   │   ├── index.ts          # export { webDomain } — domain plugin hard requirement
│   │   ├── web-domain.tsx    # createWebDomain("feeds"): routes + navItems/homeTile capability
│   │   ├── domain-layout.tsx # Business-area layout (DigestFiltersProvider)
│   │   ├── host-shell.tsx    # Standalone-only compact left nav (host concern, not in domain)
│   │   ├── main.tsx          # Standalone host entry: composes feeds + dsh domains (host-only)
│   │   ├── pages/            # Business pages (trending, starred, digest, topics, feeds, settings, admin) — page.tsx only
│   │   ├── components/       # Business components (FeedCard, FilterBar, TopicRepoCard, …) — no shell chrome
│   │   ├── hooks/            # usePersistedFeedFilters, use-digest-list, use-page-size, use-topics
│   │   ├── services/         # API client (feeds.ts, topics.ts, external.ts, hidden.ts) — API + static modes
│   │   ├── types/            # TypeScript domain types (feed.ts, topics.ts)
│   │   ├── lib/              # utils.ts (cn, formatNumber, formatDate), feed-filters-storage.ts
│   │   └── styles.css        # Tailwind CSS v4 theme + dark mode
│   ├── plugin.json           # innate.plugin.v1, kind: "domain"
│   ├── index.html
│   ├── scripts/              # Bun build toolchain (no Vite)
│   │   ├── build.ts          # Prod build: Tailwind engine + Bun.build + index.html assembly + Pages 404
│   │   ├── dev.ts            # Dev server: /api proxy, rebuild on change (src + ../shared + ../dsh), SSE live reload
│   │   └── preview.ts        # Static server for dist/ (replaces `vite preview`)
│   ├── package.json          # name: @innate/domain-feeds; @innate/ui + @innate/web-domain via innate-fe-cli install
│   └── tsconfig.json
├── admin/                   # @innate/domain-admin — 后台管理独立项目（issue #70：采集任务可视化 + SQLite 工作台，innate-fe 方式 = @innate/ui + admin-composites）
│   ├── src/
│   │   ├── index.ts          # export { webDomain }
│   │   ├── web-domain.tsx    # createWebDomain("admin"): /admin/tasks + /admin/sqlite 路由 + navItems
│   │   ├── domain-layout.tsx # admin business-area layout (scroll container)
│   │   ├── host-shell.tsx    # 独立宿主紧凑左栏（host-only）
│   │   ├── main.tsx          # 独立宿主入口（host-only）
│   │   ├── pages/            # tasks/page.tsx（任务面板）、sqlite/page.tsx（自 frontend/src/pages/admin 迁入）
│   │   ├── components/       # task-status-badge / run-log-dialog / schedule-dialog
│   │   ├── services/         # admin-tasks.ts（/api/admin/tasks/*）、admin-db.ts（/api/admin/db/*，迁入）
│   │   ├── types/            # tasks.ts — 任务后台 wire 类型
│   │   └── lib/              # utils.ts (cn, formatDuration/formatRelative)
│   ├── scripts/              # Bun build toolchain（dev :3001 代理 /api → :4000；build；preview :4174）
│   ├── plugin.json           # innate.plugin.v1, kind: "domain", id: admin, order 50
│   ├── package.json          # name: @innate/domain-admin; @innate/ui + @innate/admin-composites + @innate/web-domain
│   └── tsconfig.json
├── topics/                   # 域插件包（M0 收编 dsh + edu-animate；每个一级 topic 一个包，见 docs/research/projects/topic-platform-redesign.md）
│   ├── dsh/                      # @innate/domain-dsh — DSH plugin directory domain plugin (issue #13 拆分)
│   │   ├── src/
│   │   │   ├── index.ts          # export { webDomain }
│   │   │   ├── web-domain.tsx    # createWebDomain("dsh"): /dsh* routes + navItems/homeTile
│   │   │   ├── domain-layout.tsx # dsh business-area layout (scroll container)
│   │   │   ├── pages/            # page.tsx, categories-page.tsx, category-page.tsx, detail-page.tsx
│   │   │   ├── components/       # plugin-card / plugin-listing / plugin-list-item (+ vendored markdown-body, copy-install-button)
│   │   │   ├── services/         # plugins.ts — API client + static-mode client-side search mirror
│   │   │   ├── types/            # plugin.ts, dsh.ts
│   │   │   └── lib/              # utils.ts (cn)
│   │   ├── plugin.json           # innate.plugin.v1, kind: "domain", id: dsh, order 30
│   │   ├── package.json          # name: @innate/domain-dsh; 跨包引用根 shared/（plugin-categories、types/plugins），由宿主 main.tsx 直接打进 bundle
│   │   └── tsconfig.json
│   ├── edu-animate/              # @innate/domain-edu-animate — 教育动画垂直域（skills + 双源教学视频：YouTube / B 站）
│   ├── ux-design/           # @innate/domain-ux-design — UI/UX Design 主题域（B10：topics 快照消费，无自有采集器）
│   │   ├── src/
│   │   │   ├── index.ts          # export { webDomain }
│   │   │   ├── web-domain.tsx    # createWebDomain("edu-animate"): /edu* routes + navItems/homeTile
│   │   │   ├── domain-layout.tsx # edu business-area layout (scroll container)
│   │   │   ├── pages/            # page.tsx (skills), videos-page.tsx
│   │   │   ├── components/       # skill-card / video-card / edu-filter-bar / edu-pagination / copy-button
│   │   │   ├── services/         # edu.ts — API client + static-mode client-side filter/sort/pagination
│   │   │   ├── types/            # edu.ts
│   │   │   └── lib/              # utils.ts (cn), format.ts
│   │   ├── plugin.json           # innate.plugin.v1, kind: "domain", id: edu-animate, order 40
│   │   ├── package.json          # name: @innate/domain-edu-animate; self-contained (relative imports only)
│   │   └── tsconfig.json
├── docs/                    # Documentation
├── tasks/                   # Task working directories
├── package.json             # Root bun workspace (workspaces: backend, frontend, admin, topics/*)
└── CLAUDE.md
```

## Technology stack

| Layer | Technology |
|---|---|
| Runtime | Bun / Node.js 18+ |
| Frontend framework | React 19 |
| Routing | TanStack Router (manual route registration, not file-based) |
| Build tool | Bun's bundler — backend `bun build --target=bun`, frontend `Bun.build` via `frontend/scripts/` (no Vite) |
| Styling | Tailwind CSS v4 with CSS-based theme configuration, compiled by `@tailwindcss/node` + `@tailwindcss/oxide` |
| UI primitives | shadcn/ui v4 (official Base UI edition, `base-vega` preset) vendored in `frontend/src/components/ui/` via the shadcn CLI |
| UI utilities | `lucide-react`, `cn`, `class-variance-authority`, `tw-animate-css`, `sonner` (toasts), `next-themes` |
| Backend framework | Hono 4 |
| HTTP server | `@hono/node-server` |
| Database | SQLite via `bun:sqlite` (no native addons, bundle-friendly) |
| Data fetching | GitHub CLI (`gh`) and Firecrawl |
| Validation | Zod (used in API input validation) |
| Type checking | TypeScript 5.7+ |
| Plugin directory | Own domain plugin `@innate/domain-dsh` (`dsh/`), routes under `/dsh`, data from Hono `/api/plugins` (awesome-dsh-plugin market catalog, datasource in `backend/src/dsh/`) |
| Education-animation domain | Own domain plugin `@innate/domain-edu-animate` (`topics/edu-animate/`), routes under `/edu`, data from `edu-skills` / `edu-videos`（YouTube）/ `edu-videos-bilibili`（B 站）external sources (`/api/external/*`) |

## Build and development commands

All commands assume you are in the project root unless noted.

### Install dependencies

The repo is a workspace (`workspaces: backend, frontend, topics/*`, `pnpm-workspace.yaml`). `@innate/ui` / `@innate/web-domain` come from the innate-fe base repo via a private registry — run `innate-fe-cli install` first (see [docs/arch-design/innate-fe-plugin-migration.md](docs/arch-design/innate-fe-plugin-migration.md)). Installs are **pnpm**-based (fresh @innate/* tarballs never match `bun.lock` integrity hashes, so don't use `bun install` at the root):

```bash
export INNATE_FE_ROOT=/path/to/innate-fe
bun run setup:innate   # publish @innate/* → write frontend/.npmrc → pnpm install
cp frontend/.npmrc .npmrc   # root .npmrc is required for @innate scope resolution
pnpm install           # = bun run install:all
```

### Start development

```bash
# Start backend (http://localhost:4000) and frontend (http://localhost:3000) together
bun run dev            # concurrently -k -n backend,frontend

# Seed static snapshots into SQLite first, then start (avoids empty UI)
bun run dev:seed

# Individually
bun run dev:backend   # cd backend && bun run dev
bun run dev:frontend  # cd frontend && bun run dev
```

The Bun dev server (`frontend/scripts/dev.ts`) proxies `/api` requests to `http://localhost:4000`, rebuilds the bundle on file change, and live-reloads the page (JS changes reload; CSS-only changes hot-swap the stylesheet). Plugin directory is `http://localhost:3000/dsh`.

### Plugin directory (`/dsh`)

The DSH plugin browser is a separate domain plugin (`@innate/domain-dsh`, `topics/dsh/`) composed into the same standalone app by `frontend/src/main.tsx` (same sidebar and theme; issue #13 split). The Hono backend prefers `~/.innate/awesome-dsh/plugin-catalog.json` (`INNATE_HOME` controls the root; `DSH_PLUGIN_DATA_DIR` can point at an alternate legacy data directory) via the extracted datasource in `backend/src/dsh/`; the legacy YAML files are still the fallback. Static mode ships the same catalog as `frontend/public/data/plugins.json`, exported by `backend/src/dsh/export.ts`; `topics/dsh/src/services/plugins.ts` mirrors the backend's search/sort/pagination client-side. This generated catalog is intentionally local-only and not committed.

Refresh the Awesome DSH catalog with `bun run data:sync:awesome-dsh` from the root. It reads the upstream format-1 market index and enriches Stars through GitHub GraphQL; then run `bun run data:export` to regenerate `plugins.json`. Daily and window Pages syncs run this automatically in CI, but only the build artifact is uploaded—not the collected JSON.

### 后台管理项目（`admin/`，issue #70）

独立的后端管理控制台（innate-fe 方式：@innate/ui + @innate/admin-composites，webDomain 路由），
可视化 M-Sync 采集任务（手动触发 / 运行日志 / 运行历史 / 定时自动运行），并承接 SQLite 工作台
（自 `frontend/src/pages/admin` 迁入）。仅 API 模式（依赖本地 Hono 后端）。

```bash
# 与前端同法：dev server 端口 3001，/api 代理到 :4000
bun run dev:admin            # 从仓库根（= cd admin && bun run dev）
cd admin && bun run build    # 生产构建到 admin/dist/
cd admin && bun run preview  # 静态预览（端口 4174，同样代理 /api）

# 后台任务 API（须先跑 backend；--no-admin / ADMIN_DB_UI=off 会一并关闭）
curl http://localhost:3001/api/admin/tasks/jobs            # 任务注册表 + 状态 + 调度
curl -X POST http://localhost:3001/api/admin/tasks/jobs/<id>/run   # 手动触发（子进程 cli sync job <id>）
curl -X POST http://localhost:3001/api/admin/tasks/jobs/run-batch \
  -H "Content-Type: application/json" -d '{"tag":"github"}'         # 按 DB 标签批量启动（或 {"group":"external"} / {"jobIds":[...]}）
curl http://localhost:3001/api/admin/tasks/tags                   # DB 标签字典（github/dsh/topics/news）+ 任务数
curl -X PUT http://localhost:3001/api/admin/tasks/jobs/<id>/tags \
  -H "Content-Type: application/json" -d '{"tags":["github","news"]}'  # 覆盖式改标签
curl "http://localhost:3001/api/admin/tasks/runs?limit=20" # 运行历史
curl http://localhost:3001/api/admin/tasks/runs/<runId>    # 运行详情 + 日志尾部
curl -X POST http://localhost:3001/api/admin/tasks/runs/<runId>/cancel
curl -X PUT http://localhost:3001/api/admin/tasks/schedules/<jobId> \
  -H "Content-Type: application/json" -d '{"enabled":true,"everyMinutes":60}'   # 定时自动运行
```

运行与调度落在 `$INNATE_HOME/admin/tasks/`（runs.json / schedules.json / logs/）；
运行器以子进程执行 `bun src/app/cli.ts sync job <id>`（不进 API 进程内采集，见
`backend/src/app/task-runner.ts` 头注）。任务面板运行中 5s 轮询、空闲 15s。

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

# Sync only recently starred (last 24h) — incremental
bun run sync:starred:recent

# Last 90 days of digest issues + current trending + starred window + READMEs
bun run sync:window
# or from repo root: bun run data:sync:window

# CLI equivalents
bunx tsx src/app/cli.ts sync all-trending
bunx tsx src/app/cli.ts sync trending daily
bunx tsx src/app/cli.ts sync starred [username] [--force] [--days N]
bunx tsx src/app/cli.ts sync digest --days 90
bunx tsx src/app/cli.ts sync window [--days 90] [--skip-readme] [--force]
```

### Sync external sources (Product Hunt / YC / a16z / Hacker News / Hugging Face / GitHub New / Dev.to / lobste.rs / GitHub Topics / Edu Skills / Edu Videos / Edu Videos bilibili)

These are independent JSON-based collectors (no SQLite, see `docs/arch-design/external-collectors.md`).

```bash
cd backend

# Product Hunt — daily/weekly/monthly leaderboards (Firecrawl)
bun run sync:producthunt                                           # today, all periods
bun src/app/cli.ts sync producthunt --period daily                 # daily only
bun src/app/cli.ts sync producthunt --period weekly --date 2026-08-25
bun src/app/cli.ts sync producthunt --period monthly --date 2026-08-01

# YC Companies — public API (no auth)
bun run sync:yc                                                    # all default batches
bun src/app/cli.ts sync yc --batch P26 --query "open source"

# a16z Portfolio — static list + GitHub enrichment
bun run sync:a16z

# Hacker News — front page via Algolia API (GH #31)
bun run sync:hackernews
bun src/app/cli.ts sync hackernews                # --date 2026-10-31 for top-of-day

# Hugging Face — trending models/datasets/spaces (GH #31; blocked on some networks)
bun run sync:huggingface

# GitHub New — repos created in the last N days, top by stars (GH #31)
bun run sync:github-new                           # --days 30 --min-stars 20
bun src/app/cli.ts sync github-new --days 7

# Dev.to — hot articles (GH #31)
bun run sync:devto

# lobste.rs — hottest stories (GH #31)
bun run sync:lobsters

# GitHub Topics — search repos by topic (AI/LLM/Agent/EdTech etc.)
bun run sync:topics                                                # all topics, top 50 each
bun src/app/cli.ts sync github-topics --topic llm --topic agent    # specific topics
bun src/app/cli.ts sync github-topics --topic edtech --limit 50    # single topic, top N
bun run topics:list                                                # list available topics

# Trendshift — trending ranking archives (daily/weekly/monthly/yearly × 16 language slices)
bun run sync:trendshift                                            # all timeframes, "all" language slice
bun src/app/cli.ts sync trendshift --language python,rust          # specific language slices
bun src/app/cli.ts sync trendshift --source scrape --timeframe daily  # fallback scraper

# GitHub Hot — 跨源热度榜（GH #63，digest/trending/trendshift/github-new × 24h 半衰）
bun run sync:hot                                                   # 构建今日快照 + 导出 frontend/public/data/hot

# Awesome DSH — upstream market index + GitHub GraphQL stars (GH #30)
bun run sync:awesome-dsh

# Legacy DSH YAML snapshot (GH #27, manual fallback only)
bun src/app/cli.ts sync dsh-catalog --dry-run

# Edu Skills — 教育动画领域的 Agent Skill（skills.sh sitemap + JSON-LD + GitHub 补充）
bun run sync:edu-skills                      # 实测 443 条 / 128 仓库
bun src/app/cli.ts sync edu-skills --max 200 # 限制领域候选数（默认 600）

# Edu Videos — 策展频道的教学视频（只收元数据 + 链接；需要 YOUTUBE_API_KEY）
bun run sync:edu-videos

# Edu Videos (bilibili) — B 站策展 UP 主投稿（Firecrawl：search 解析 mid → 渲染抓取；见 docs/arch-design/edu-videos-bilibili.md）
cd backend && bun src/app/cli.ts sync edu-videos-bilibili

# Unified sync (all 10 JSON-store external sources; per-source failures don't abort)
bun run sync:vc                # all 10 sources; root data:sync:external (daily) excludes producthunt pending GH #33
bun src/app/cli.ts sync vc --source producthunt --source hackernews

# GH #31 local daily update (trending+starred recent + digest + topics + external)
bun run data:update:local      # from repo root; wired to the Orca daily automation
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

### Static data export / import

```bash
cd backend

# Export incremental JSON chunks (for GitHub Pages static mode)
bun run export:incremental

# Full static export
bun run export:static

# Import static JSON data back into SQLite
bun run import:static
```

### Frontend build

```bash
cd frontend
bun run dev       # Bun dev server on port 3000 (proxy + live reload)
bun run build     # Production build (Bun.build) to frontend/dist/
bun run preview   # Serve the production build on port 4173
```

The whole toolchain is Bun: `scripts/build.ts` compiles Tailwind with `@tailwindcss/node` + the oxide `Scanner` (same API the official Vite plugin used), bundles the JS with `Bun.build`, assembles `index.html` with hashed asset URLs (prefixed by `VITE_BASE_PATH`), copies `public/`, and writes `404.html` + `.nojekyll` for GitHub Pages. Env names keep the `VITE_*` prefix for CI compatibility.

### shadcn/ui components (Base UI edition)

The frontend vendors the official shadcn/ui v4 components (Base UI behavior primitives, `base-vega` preset) in `frontend/src/components/ui/` — managed by the shadcn CLI, no shared UI package dependency.

```bash
cd frontend
bun run shadcn:add button          # Add a component from the official registry
bun run shadcn:add --all           # Add everything
bun run shadcn:update              # Re-fetch every vendored component at its latest version
```

Configuration lives in `frontend/components.json` (aliases use `@/*`). Component CSS depends on the theme tokens already defined in `frontend/src/styles.css` plus `tw-animate-css`.

### Static site build (GitHub Pages)

```bash
# From repo root — sync/export first (see docs/arch-design/data-update-workflow.md), then:
bun run build:static

# Full 90-day snapshot then static build
bun run data:update:window && bun run build:static

# Or with custom base path for project pages
VITE_BASE_PATH=/your-repo bun run build:pages
```

### Type checking

```bash
cd backend  && bun run typecheck
cd frontend && bun run typecheck
cd dsh      && bun run typecheck
```

### Code formatting

```bash
bun run format:ts         # Format all TS files with Prettier
bun run format:ts:check   # Check formatting without writing
```

## Runtime architecture

```
┌─────────────────┐      /api/*       ┌─────────────────────────────┐
│  Bun dev server │ ─────────────────> │  Hono server (backend/src/  │
│  scripts/dev.ts │   (proxied)        │  app/server.ts) port 4000   │
│  port 3000      │                    │  (prod: bun dist/server.js) │
└─────────────────┘                    └─────────────────────────────┘
                                                  │
                       ┌──────────────────────────┼──────────────────────────┐
                       ▼                          ▼                          ▼
                 bun:sqlite                  sync.ts / cli.ts              gh / Firecrawl
                 (feeds.db)                  github.ts firecrawl.ts
```

### Dual deployment modes

1. **API mode** (default): Frontend calls `/api/*` endpoints, backed by SQLite. README disk cache (`./readmes`) is returned immediately; the backend refreshes from GitHub in the background. Digest is served from the newest local dump (`~/.innate/digest` or `frontend/public/data/digest.json`), with a live GitHub fallback if the dump is empty.
2. **Static mode** (`VITE_STATIC_MODE=true`): Frontend fetches pre-exported JSON from `/data/` (`manifest.json` chunks, `digest.json`). No backend. The browser still calls GitHub live for digest freshness and READMEs, and falls back to bundled `/data/readmes/{owner}/{repo}.md` when live fetch fails.

Both modes are meant to be used together: `bun run data:update:window` writes snapshots into the repo, then `bun run build:static` ships them. Live fetch keeps Pages from going stale between deploys.

GitHub Trending has no historical API. A 90-day window syncs **current** daily/weekly/monthly lists, starred repos in that window, digest issues **created** in that window, and README prefetch for those repos.

### API endpoints

Interactive docs: **`/docs`** (Swagger UI) · spec: **`/api/openapi.json`** (`backend/src/app/openapi.ts`).

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Service + DB health check. |
| GET | `/api/feeds` | List feed items. Query params: `type` (`trending`\| `starred`\| `digest`), `language`, `topics` (comma-separated), `search`, `sort` (`stars`\| `updated`\| `created`\| `starred`), `order` (`asc`\| `desc`), `date`, `starsMin`, `starsMax`, `page`, `pageSize`. Digest-only: `source`, `category`, `hasPrimaryUrl`. |
| GET | `/api/feeds/stats` | Aggregate stats: total repos, trending count, starred count, top languages. |
| GET | `/api/feeds/languages` | All distinct repository languages. |
| GET | `/api/feeds/dates` | Available trending snapshot dates. |
| GET | `/api/feeds/digest/:id` | Single digest item (with body). |
| GET | `/api/external` | External feed sources index (GH #31): Product Hunt / YC / a16z / Hacker News / Hugging Face / GitHub New / Dev.to / lobste.rs / edu-skills / edu-videos / edu-videos-bilibili with latest snapshot meta. |
| GET | `/api/external/:source` | One external source's latest snapshot (`?label=` for a specific manifest entry). |
| POST | `/api/feeds/sync` | Trigger sync. Body validated with Zod: `{ type: "trending" \| "starred" \| "all-trending", period?, username?, force?, days? }`. |
| POST | `/api/feeds/hide` | Hide an item so it is filtered out of all list/detail responses. Body: `{ kind: "digest" \| "repo", id }` (`id` = digest item id, or repo `fullName`). Persisted to `hidden.json` next to the DB; also applied at static-export time. |
| POST | `/api/feeds/unhide` | Undo a hide. Same body as `/api/feeds/hide`. |
| GET | `/api/readmes` | List cached READMEs (`root` + `items`). |
| GET | `/api/repos/:owner/:repo/readme` | README JSON (`{ fullName, markdown, cached }`); disk cache first, GitHub fallback. |
| GET | `/api/repos/:owner/:repo/readme/download` | Download README as `text/markdown` attachment. |
| GET | `/api/plugins` | DSH plugin search. Query: `q`, `category` (csv), `sort`, `page`, `perPage`. |
| GET | `/api/trendshift` | Trendshift slice index (timeframes, languages, synced files). |
| GET | `/api/trendshift/:timeframe` | Ranking slice. Query: `language` (default `all`), `period` (optional). Local store first, live CDN fallback. |
| GET | `/api/hot` | GitHub Hot ranked snapshot (GH #63). Query: `date` (default latest), `limit` (default 50). Hidden repos filtered at read time. |
| GET | `/api/hot/dates` | Available hot snapshot dates, newest first. |
| GET | `/api/plugins/stats` | Plugin totals. |
| GET | `/api/plugins/categories` | Fixed 23 awesome-dsh-plugin categories. |
| GET | `/api/plugins/:slug` | Plugin detail. |
| GET | `/api/plugins/:slug/related` | Related plugins. |
| GET | `/api/topics` | GitHub Topics datasource index (GH #24): synced and user-added topics with `count` / `newCount` / `existingCount` / `fetchedAt`; unsynced user topics use `fetchedAt: ""`. |
| POST | `/api/topics` | Save a user-added topic (GH #26). Body: `{ topic }`; persisted to `~/.innate/github-topics/topics/user-topics.json`. |
| GET | `/api/topics/:topic` | One topic snapshot (GH #24): full top-N list, skipped repos included, flagged `isNew` / `existing`. |
| GET | `/api/auth/status` | gh CLI + PAT presence (never returns the token). |
| PUT | `/api/auth/pat` | Store GitHub PAT encrypted at rest. Body: `{ token }`. |
| DELETE | `/api/auth/pat` | Remove the stored PAT. |
| GET | `/api/admin/db/tables` | All tables + row counts (admin workspace, API mode only). |
| GET | `/api/admin/db/tables/:name/schema` | Columns / indexes / DDL for one table. |
| POST | `/api/admin/db/query` | Execute a single read-only SELECT/WITH on a dedicated readonly connection; results capped at 500 rows. Body: `{ sql }`. |
| GET / POST | `/api/admin/db/queries` | Saved SQL list / create (seeded with example queries). |
| PUT / DELETE | `/api/admin/db/queries/:id` | Update / delete a saved SQL. |
| POST | `/api/admin/db/json/scan` | Scan JSON dir (default `~/.innate`, override `ADMIN_JSON_DIR`) into the temp `json_documents` registry. |
| GET | `/api/admin/db/json/files` | Registered JSON files. |
| GET | `/api/admin/tasks/jobs` | 采集任务注册表（SYNC_JOBS）+ 运行状态 + 调度配置 + **DB 标签**（每个 job 的 `tags` + 顶层 `tags` 字典/计数，issue #70）。 |
| POST | `/api/admin/tasks/jobs/:id/run` | 手动触发一次后台运行（子进程 `cli sync job <id>`；同 job 并发返回 409）。 |
| POST | `/api/admin/tasks/jobs/run-batch` | 批量/一键启动：body `{ jobIds?: string[], group?: "core"\|"external"\|"topics"\|"vertical"\|"pipeline", tag?: "github"\|"dsh"\|"topics"\|"news" }`，逐条返回 `{ jobId, run?, error? }`；全局并发上限 4（超出该条目返回错误，201/409 表示是否有任务启动）。 |
| GET | `/api/admin/tasks/tags` | DB 标签字典 `task_tags` + 每个标签下的任务数。 |
| PUT | `/api/admin/tasks/jobs/:id/tags` | 覆盖式设置任务标签 `{ tags: string[] }`（写入 `task_job_tags`；未知 slug 返回 400）。 |
| GET | `/api/admin/tasks/runs` | 运行历史（`?jobId=` 过滤、`?limit=` 默认 50 最大 200）。 |
| GET | `/api/admin/tasks/runs/:runId` | 运行详情 + 日志尾部（≤200KB）。 |
| POST | `/api/admin/tasks/runs/:runId/cancel` | 取消运行中的任务（kill 子进程）。 |
| GET | `/api/admin/tasks/schedules` | 全部定时调度配置。 |
| PUT / DELETE | `/api/admin/tasks/schedules/:jobId` | 设置 `{enabled, everyMinutes}`（5 ~ 10080）/ 停用调度。 |

### Admin workspace (`/admin`)

Simplified SQLite workbench + 采集任务后台（issue #70）, API mode only (not available in static/Pages mode): SQLite 左 = tables with row counts, center = CodeMirror SQL editor (highlighting, Ctrl/Cmd+Enter) + result table, right = saved SQL；任务页 = 任务注册表 / **DB 标签分组（task_tags/task_job_tags）** / 手动 + 批量触发 / 实时日志 / 运行历史 / 定时调度。On by default — **disable with `--no-admin` or `ADMIN_DB_UI=off`** (convenience script `bun run dev:no-admin`; 该开关同时关闭 `/api/admin/tasks/*` 与调度器). Query logic lives in `backend/src/app/admin-db.ts`; 任务运行器/调度在 `backend/src/app/task-runner.ts` + `admin-tasks.ts`；**UI 已迁至独立后台项目 `admin/`**（`admin/src/pages/sqlite/page.tsx` + `admin/src/pages/tasks/page.tsx`，dev 端口 3001）。

### Sync pipeline

1. **Trending**: `sync.ts` calls `fetchTrendingWithFirecrawl()` first. If Firecrawl returns no results, it falls back to `fetchTrendingRepos()`, which scrapes `https://github.com/trending` via `gh api` and then fetches full repo metadata via the GitHub API.
2. **Starred**: `sync.ts` calls `fetchStarredReposWithDate()`, which paginates through `gh api user/starred` (or `users/{username}/starred`) using the `application/vnd.github.v3.star+json` accept header to obtain `starred_at` timestamps. Supports incremental sync via `stopAt` / `days` parameters.
3. Both pipelines call `upsertTrendingRepo()` / `upsertStarredRepo()`, `insertTrendingTopics()` / `insertStarredTopics()` inside a single `bun:sqlite` transaction.
4. **Window sync** (`sync window`, default 90 days): current trending + starred since cutoff + digest issues created in-window + README prefetch into `./readmes` and `frontend/public/data/readmes`.
5. **Digest**: `issues-digest.ts` writes JSON (not SQLite). `data:export` copies the newest dump to `frontend/public/data/digest.json`.
6. **README (API)**: `fetchRepoReadme()` is cache-first with a background remote refresh. **README (static / browser)**: live GitHub first, bundled `/data/readmes` fallback. Batch prefetch skips files newer than 7 days unless `--force`.

## Database

SQLite database file: `~/.innate/feeds.db` by default (configurable via `DB_PATH` or `INNATE_HOME` env vars). Uses WAL mode with foreign keys enabled.

**数据目录统一约定**：本地数据（feeds.db + 各采集源 JSON + admin/tasks）统一放默认
`INNATE_HOME = ~/.innate`，跨 worktree / 跨检出共享；**不要在仓库检出内另建 `.innate`**
（2026-11-11 曾因主检出存在 `.innate` 分叉导致换环境后数据"丢失"，已合并退役为
`.innate.retired-20261031`）。若某环境数据"消失"，先查 `INNATE_HOME` 是否被显式指定。

Schema is defined in `backend/src/db/schema.sql`:

- `trending_repos` — trending repository snapshots (composite text PK `trending-{date}-{period}-{repoId}`, includes `period`, `snapshot_date`).
- `trending_repo_topics` — many-to-many topics for trending repos.
- `starred_repos` — starred repository metadata (integer PK = GitHub repo ID, includes `starred_at`).
- `starred_repo_topics` — many-to-many topics for starred repos.
- `trending_snapshots` — historical snapshot analytics table (defined but not yet written to by sync code).
- `hot_snapshots` — GitHub Hot ranked snapshots (GH #63, M1): one ranked list per day, `rule_version` travels with every row; kept ≤30 days by `saveHotSnapshot`. Built by `backend/src/curation/heat.ts` (`cli sync hot`).
- `task_tags` — 采集任务标签字典（`github` / `dsh` / `topics` / `news`），issue #70 跟进；首次读取时由 `backend/src/data/task-tags-store.ts` 播种。
- `task_job_tags` — 任务 ↔ 标签多对多（`job_id` = SYNC_JOBS.id）。分组以库为准，可直接在 SQLite 工作台增删；后台任务页按主标签（`sort_order` 最小）分组排列。

## Code organization and conventions

### TypeScript / general

- **ES modules** everywhere (`"type": "module"` in both `package.json` files).
- **Strict TypeScript** is enabled (`strict: true`).
- **Path alias**: `@/*` maps to `src/*` in the frontend. In the backend, local imports use relative paths with explicit `.js` extensions (e.g., `import { … } from "./db/index.js"`).
- **Tests** run with `bun run test` (= `bun test`; vitest is not used because its bundler cannot parse bun-only `with { type: "text" }` imports). Test files: `backend/src/**/*.test.ts`.

### Backend

- `collectors/` 按 core（GitHub 系）/ external（外部 JSON 源）/ vertical（垂直 topic 源）分组（M0）。
- `collectors/jobs.ts` **M-Sync 任务注册表**（单一事实源）：每个采集小模块一条记录
  （id/组/命令/产出）；`cli sync jobs` 列出全部、`cli sync job <id>` 执行单个；
  新增采集器 = 实现模块 + 登记 job。
- **M-API / M-Sync 边界**：`app/server.ts` 禁止调用 collectors 的写路径/采集编排，
  唯一例外 `POST /api/feeds/sync`（手动触发，已注释）；只读白名单例外：
  README 回源（`fetchRepoReadme`）、trendshift 本地切片（后续迁 `data/`）。
- `app/server.ts` — Hono HTTP server with Zod input validation, global error handler, and try/catch on all routes.
- `app/cli.ts` — mirrors the sync/list/stats functionality for command-line use.
- `collector/github.ts` — wraps the `gh` CLI with `execFileSync` (not `execSync`) to prevent shell injection. Validates `username` against a whitelist regex.
- `collector/firecrawl.ts` — uses the `firecrawl` SDK to scrape GitHub Trending with a JSON extraction schema. Generates deterministic repo IDs from SHA-256 hash of `fullName`.
- `collector/sync.ts` — orchestrates trending/starred sync with transactional writes.
- `collector/sync-window.ts` — 90-day window: trending + starred + digest + README prefetch for static/API snapshots.
- `collector/producthunt.ts` — Product Hunt daily/weekly/monthly leaderboard collector (Firecrawl + HTML fallback). Stores JSON to `~/.innate/producthunt/`.
- `collector/yc-companies.ts` — YC Companies public API collector. Stores JSON to `~/.innate/yc/`.
- `collector/a16z-portfolio.ts` — a16z AI Portfolio static list + GitHub enrichment. Stores JSON to `~/.innate/a16z/`.
- `collector/github-topics.ts` — GitHub Topics search via GitHub Search API. Keeps the top N (default 50) repos per topic and skips repos already in the feeds / already seen in that topic (GH #24). Stores JSON to `~/.innate/github-topics/`.
- `collector/awesome-dsh.ts` — normalizes the Awesome DSH market index and refreshes Stars via GitHub GraphQL (GH #30). Writes the local plugin catalog under `~/.innate/awesome-dsh/`.
- `collector/dsh-catalog.ts` — legacy tarball updater for vendored YAML snapshots (GH #27). Manual fallback only; large generated data is not committed.
- `collector/edu-skills.ts` — 教育动画领域的 SKILL 采集器：skills.sh sitemap（2 分片 × 10,000 条）→ slug 级领域过滤 → 详情页 JSON-LD（安装量/描述）→ GitHub API 补 stars/license/topics（可选）。详情页抓取有 10 分钟总时限，到点用部分结果收工。存 `~/.innate/edu-skills/`。
- `collector/edu-videos.ts` — 教育动画教学视频采集器：策展 **handle** 列表（不是 channel id）→ `channels.list?forHandle=` 解析 → uploads 播放列表 → `videos.list` 取详情。全程走 1 单位档（不用 `search.list` 的 100 单位）。只收元数据 + 链接。需要 `YOUTUBE_API_KEY`。存 `~/.innate/edu-videos/`。
- `collector/vc-portfolio.ts` — Unified orchestrator for all external collectors.
- `collector/shared/types.ts` — Shared types (`ExternalFeedItem`, `FeedCollector`, `FeedSource`).
- `collector/shared/storage.ts` — JSON storage abstraction (manifest + saveItems).
- `collector/shared/http.ts` — HTTP utilities (fetchJson, fetchHtml, retry).
- `data/export-incremental.ts` — exports data as incremental JSON chunks with a manifest for static mode.
- `data/import-static.ts` — imports static JSON back into SQLite.
- `data/topics-store.ts` — GitHub Topics snapshots (`~/.innate/github-topics/topics/{topic}.json` + `index.json`), user-added topic persistence (`user-topics.json`, GH #26), and the DTO mapping used by the API/static export.
- `data/export-topics.ts` — exports the topic snapshots to `frontend/public/data/topics/` (static mode), resolving the "existing" flag from SQLite.
- `db/index.ts` — all SQL lives here. Uses prepared statements from `bun:sqlite`. Batch-fetches topics to avoid N+1 queries. Exports typed interfaces (`FeedItemDTO`, `FeedStatsDTO`, `TrendingItemRow`, `StarredItemRow`).
- `curation/heat.ts` — GitHub Hot heat engine (GH #63): per-source signal extraction (digest / trending / trendshift / github-new), independent-source dedupe, 24h half-life decay, deterministic ranking; `data/export-hot.ts` exports snapshots to `frontend/public/data/hot/`.
- `db/paths.ts` — resolves database path via `DB_PATH` env var or `INNATE_HOME` (defaults to `~/.innate`).

### Frontend

- `router.tsx` manually wires routes (`__root`, `index`, `trending`, `starred`). `index` redirects to `/trending`. Supports GitHub Pages base path.
- Page components (`trending/page.tsx`, `starred/page.tsx`) manage state with `useState` / `useEffect` / `useCallback` and call `services/feeds.ts`.
- `FilterBar` implements 300ms search debouncing to avoid excessive API calls.
- `usePersistedFeedFilters` hook persists filter state to localStorage.
- Components use `React.forwardRef` and accept a `className` prop merged via the `cn()` utility.
- `services/feeds.ts` supports both API and static modes. In static mode, fetches JSON chunks via `manifest.json`, merges digest `digest.json` with live GitHub, and prefers live READMEs with a static-file fallback.
- `services/topics.ts` — GitHub Topics datasource client (GH #24): `/api/topics*` in API mode, `/data/topics/*.json` in static mode; POST `/api/topics` is API-only (GH #26).
- `pages/topics/` — topic index + topic detail view (GH #24): badges `New` / `In feeds`, topic chips navigate to the clicked topic.
- `services/hidden.ts` tracks user-hidden items (localStorage + `/api/feeds/hide`; static mode also merges the exported `hidden.json`). `feeds.ts` filters them out of every list/detail response.
- `styles.css` defines a Tailwind v4 theme with CSS custom properties and a `.dark` variant. **sprint-3 起基色为 AIHot 调色板**（纸感底/teal accent，`--sidebar` 用 sunk 档），叠加 ink/hot/rank 色阶与 radius 六档扩展层；shadcn token 名不变。Additional themes available via `themes/linear.css` and `themes/notion.css`.
- **AIHot 布局原语**在 `frontend/src/components/layout/`（ReadingLayout / EmptyState / PillTabs）；热点榜组件 `components/hot-board.tsx`（trending 页三层结构）。
- **导航可见性**（host 裁量）：`frontend/src/nav-visibility.ts` 决定侧栏露出——主页 / Trending / Trending Shift / Starred / 主题组（EDU、UI/UX Design）；digest/topics/feeds/dsh 为 hidden（路由保留 URL 直达）。「主题」组按域包 navItems `group: "主题"` 约定挂入，新增 `topics/<id>/` 域包即自动出现。SQLite / 任务后台已迁往独立 `admin/` 项目（issue #70）。

## Where to make changes

| If you are… | Go to… |
|---|---|
| Adding or changing API endpoints | `backend/src/app/server.ts` |
| Changing the admin DB workspace API | `backend/src/app/admin-db.ts`, `backend/src/data/admin-saved-queries.ts` |
| Changing the SQLite workbench UI | `admin/src/pages/sqlite/page.tsx`, `admin/src/services/admin-db.ts`（issue #70 迁出自 frontend） |
| Changing the 采集任务后台（运行 / 调度 / 日志） | `backend/src/app/task-runner.ts`, `backend/src/app/admin-tasks.ts`, `backend/src/data/task-runs-store.ts`, `admin/src/pages/tasks/page.tsx`, `admin/src/services/admin-tasks.ts` |
| Changing 任务标签 / 分组（github·dsh·topics·news） | `backend/src/data/task-tags-store.ts`, `backend/src/db/schema.sql`（`task_tags` / `task_job_tags`），默认映射在 `DEFAULT_JOB_TAGS`；后台可直接用 SQLite 工作台改表 |
| Changing the admin console host shell / theme | `admin/src/host-shell.tsx`, `admin/src/styles.css`（AIHot 主题与 frontend/src/styles.css 统一） |
| Changing how repos are fetched from GitHub | `backend/src/collectors/core/github.ts` |
| Changing trending/starred/window sync | `backend/src/collectors/core/sync.ts`, `sync-window.ts`, `firecrawl.ts` |
| Changing the 90-day window / README prefetch | `backend/src/collectors/core/sync-window.ts` |
| Changing digest issues sync | `backend/src/collectors/core/issues-digest.ts` |
| Adding/changing external collectors (PH/YC/a16z/Topics) | `backend/src/collectors/external/producthunt.ts`, `yc-companies.ts`, `a16z-portfolio.ts`、`backend/src/collectors/core/github-topics.ts` |
| Changing external feed sources / the Feeds menu (GH #31) | `backend/src/collectors/external/{hackernews,huggingface,github-new,devto,lobsters}.ts`, `backend/src/data/external-store.ts`, `backend/src/data/export-external.ts`, `frontend/src/types/external.ts`, `frontend/src/pages/feeds/`, `frontend/src/services/external.ts` |
| Changing Trendshift archives (GH #23) | `backend/src/collectors/external/trendshift.ts`, `backend/src/data/export-trendshift.ts`, `frontend/src/pages/trending-shift/`, `frontend/src/services/trendshift.ts` |
| Changing the GitHub Hot heat engine (GH #63) | `backend/src/curation/heat.ts`, `backend/src/db/index.ts` (hot helpers), `backend/src/data/export-hot.ts`, `backend/src/app/cli.ts` (`sync hot`) |
| Changing the Awesome DSH catalog (GH #30) | `backend/src/collectors/vertical/awesome-dsh.ts`, `backend/src/dsh/catalog.ts`, `shared/plugin-categories.ts`, `topics/dsh/src/services/plugins.ts` |
| Changing the legacy DSH YAML updater (GH #27) | `backend/src/collectors/vertical/dsh-catalog.ts` |
| Changing the GitHub Topics datasource (GH #24) | `backend/src/collectors/core/github-topics.ts`, `backend/src/data/topics-store.ts`, `backend/src/data/export-topics.ts`, `frontend/src/pages/topics/`, `frontend/src/services/topics.ts` |
| Changing external collector shared logic | `backend/src/collectors/shared/types.ts`, `storage.ts`, `http.ts`（wire 契约在根 `shared/types/`） |
| Changing digest issues sync | `backend/src/collectors/core/issues-digest.ts` |
| Changing the database schema or queries | `backend/src/db/schema.sql` and `backend/src/db/index.ts` |
| Changing database path resolution | `backend/src/db/paths.ts` |
| Adding new CLI commands | `backend/src/app/cli.ts` and `backend/package.json` scripts |
| Changing GitHub Pages deploy / data cron | `.github/workflows/deploy.yml` |
| Changing pages / routes | `frontend/src/web-domain.tsx` (route factories) and `frontend/src/pages/*/page.tsx` |
| Changing domain nav / home tile | `frontend/src/web-domain.tsx` (`navItems` / `homeTile` capability) |
| Changing standalone host shell (compact left nav) | `frontend/src/host-shell.tsx`, `frontend/src/main.tsx` |
| Changing UI components | `@innate/ui` from the innate-fe base repo (`innate-fe-cli install`); business components in `frontend/src/components/` |
| Changing API client | `frontend/src/services/feeds.ts` |
| Changing types shared between frontend and backend concepts | `frontend/src/types/feed.ts` (backend has its own internal types in `db/index.ts`) |
| Changing shared constants (plugin categories, theme catalog) | `shared/plugin-categories.ts`, `shared/theme-catalog.ts` (non-`@innate` scope — keep it that way) |
| Changing the education-animation domain (edu-animate) | `topics/edu-animate/src/` (domain plugin @innate/domain-edu-animate), `shared/edu-categories.ts` |
| Changing the education-animation collectors | `backend/src/collectors/vertical/edu-skills.ts`, `edu-videos.ts`, `edu-videos-bilibili.ts` |
| Changing styling / theme | `frontend/src/styles.css` |
| Changing the frontend build / dev toolchain | `frontend/scripts/build.ts`, `dev.ts`, `preview.ts` |
| Bundling the backend for production | `backend/package.json` (`build` → `bun build --target=bun` into `backend/dist/`) |
| Changing the plugin directory site | `topics/dsh/src/` (domain plugin @innate/domain-dsh) |
| Changing plugin data loading | `backend/src/dsh/catalog.ts`, `backend/src/dsh/routes.ts` |
| Adding a new domain plugin | 新建 `topics/<id>/` 目录 + 根 `package.json` workspaces `topics/*` 自动纳入 + `frontend/src/main.tsx` 的 `domains` 数组 + `frontend/scripts/{build,dev}.ts` 的 Tailwind 扫描目录 |

## Repository skills

Repo-scoped skills live in `.claude/skills/` and are committed with the repo. Load one by reading its `SKILL.md` — do not re-derive its procedure from scratch.

| Skill | Use it for |
|---|---|
| `.claude/skills/feeds-sprint/SKILL.md` | Working a Sprint task in `tasks/sprint-N/` (claim → implement → write back status) |
| `.claude/skills/arch-diagram/SKILL.md` | Producing a code-grounded architecture diagram (inventory → render → screenshot-verify → commit into `docs/arch-design/`) |
| `.claude/skills/skill-eval/SKILL.md` | Judging whether a skill actually helps, via a with-skill / no-skill A-B comparison |
| `.claude/skills/topic-discovery/SKILL.md` | 从 starred 种子仓库发现 GitHub Topics：lift 分层（业务层/技术层）→ 相关性搜索（T1 共现 / T2 Jaccard / T3 GraphQL）→ × trendshift 势头交叉的 topic 精选 → CLI 同步与落盘验证 |

`arch-diagram` also ships `scripts/inventory.js` (pure Node, no deps) for deterministic repo inventory — run it, then cross-check the numbers with an independent `find` command before putting them in a diagram.

## Security considerations

- The backend enables CORS for all origins (`app.use("/*", cors())`). If deployed publicly, restrict this to known origins.
- No authentication or authorization is implemented on API endpoints. The sync endpoints should not be exposed to untrusted users.
- `github.ts` uses `execFileSync` with argument arrays (not string interpolation) to prevent shell injection. The `username` parameter is validated against `/^[\w.-]{1,39}$/`.
- POST `/api/feeds/sync` validates request body with Zod schema before processing.
- All GET API routes have try/catch error handling and return structured JSON errors.
- The SQLite database path is controlled by the `DB_PATH` environment variable or defaults to `~/.innate/feeds.db`. Ensure the database file is not served or committed.
- Environment variables: `PORT` (backend port, default 4000), `DB_PATH` (SQLite path), `INNATE_HOME` (data directory, default `~/.innate`), `VITE_STATIC_MODE` (frontend static mode), `VITE_BASE_PATH` (base URL for GitHub Pages), `ADMIN_DB_UI` (`off` disables the admin workspace; also `--no-admin`), `ADMIN_JSON_DIR` (JSON scan root for the admin workspace, default `~/.innate`).

## Deployment notes

- CI: `.github/workflows/ci.yml` (test, typecheck, format, build). Pages: `.github/workflows/deploy.yml`.
- For production API mode: `bun run start` bundles both backend (`backend/dist/server.js`) and frontend (`frontend/dist/`) with Bun, then serves the site from the backend at `http://localhost:4000` (same origin as `/api`). Bind with `HOST` / `PORT` as needed.
- For GitHub Pages: daily cron runs `sync window` (90 days) + `sync github-topics` (GH #24, top 50 per topic) then deploys `frontend/dist/`. Manual **Run workflow** can choose window / daily / skip. See `docs/arch-design/data-update-workflow.md`.
- Dev uses the Bun dev server (`frontend/scripts/dev.ts`) on port 3000 with `/api` proxied to the backend.
