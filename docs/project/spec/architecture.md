# Architecture: Innate Feeds

## 系统概览

```text
前端 (Vite + React) ──/api/*──► Hono 后端 ──► SQLite (feeds.db)
     │                              │
     └── 静态模式 (VITE_STATIC_MODE) └── gh CLI / Firecrawl 采集
              └── manifest + JSON chunks
```

## 关键决策（ADR 摘要）

| 日期 | 决策 | 原因 |
|---|---|---|
| — | 双模式：API + 静态 Pages | 本地开发用 API；公开部署免后端 |
| — | TanStack Router 手动注册 | 非 file-based，便于 GitHub Pages base path |
| — | Firecrawl 优先、gh 兜底 trending | 提高 trending 数据稳定性 |

## 模块与路径

| 模块 | 路径 | 说明 |
|---|---|---|
| API | `backend/src/app/server.ts` | Hono 路由 |
| 采集 | `backend/src/collector/` | github、firecrawl、sync |
| 数据库 | `backend/src/db/` | schema、查询 |
| 前端页面 | `frontend/src/pages/` | trending、starred |
| UI 壳 | `frontend/src/components/` | Sidebar、Header、FilterBar |
| 静态导出 | `backend/src/data/` | incremental chunks |

## 外部依赖

| 依赖 | 用途 | 备注 |
|---|---|---|
| `gh` CLI | GitHub API / trending | 需 `gh auth` |
| Firecrawl | Trending 抓取 | 可选，失败回退 gh |
| Univer | 后台数据表（规划中） | 见 [sheet-display](../issues/sheet-display.md) |
