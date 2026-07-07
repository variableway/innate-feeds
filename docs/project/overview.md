# Overview: Innate Feeds

**Slug:** `innate-feeds`  
**Status:** active  
**Version:** 0.1.0  
**Created:** 2026-07-06（控制平面登记）

## 一句话

发现与浏览 GitHub Trending / Starred 仓库；支持 API+SQLite 本地运行，或静态 JSON + GitHub Pages 发布。

## 当前阶段

| 项 | 状态 |
|---|---|
| 阶段 | **building** — 核心链路可用，UI 与数据流水线持续迭代 |
| 数据 | 静态 chunks 至 2026-07-05；日调度 `data:update` |
| CI | test、typecheck、format、build |
| 部署 | GitHub Pages workflow |
| 待办 | [sheet-display](./issues/sheet-display.md) 后台数据浏览 |

## 代码位置

| | |
|---|---|
| 元数据 | 本仓库 [`docs/project/`](.) |
| 源码 | 仓库根目录 |
| GitHub | https://github.com/variableway/innate-feeds |

## 代码仓目录结构

```text
innate-feeds/
├── backend/src/
│   ├── app/          # Hono API、CLI
│   ├── collector/    # github、firecrawl、sync
│   ├── data/         # 静态 JSON 导出/导入
│   └── db/           # SQLite
├── frontend/src/
│   ├── pages/        # trending、starred
│   ├── components/
│   ├── services/     # API + 静态双模式
│   └── hooks/
├── frontend/public/data/   # manifest + chunks
├── docs/data-update-workflow.md
├── tasks/issues/           # 代码仓内原始任务（逐步同步到本元数据）
├── .github/workflows/      # ci.yml、deploy.yml
├── Dockerfile
└── AGENTS.md
```

## 关键约束

- 双模式：API（开发）与静态 Pages（公开部署）须同时可维护
- `/api/feeds` 合约见 [feeds-api-v1](./spec/contracts/feeds-api-v1.md)
- sync API 不对外暴露给未授权用户

## 禁止事项

- 不要引入 `.agents/` 或第二套 spec/tasks
- 不要未经 issue 扩大 spec 非目标
- 不要并行修改他人 in_progress 的同一 issue

## Agent 分工（可选）

| Agent / 工具 | 当前 Issue | 分支前缀 | 状态 |
|---|---|---|---|
| claude-code | | `feature/*-claude` | |
| kimi | | `feature/*-kimi` | |
| trae | | `feature/*-trae` | |
| code-buddy | | `feature/*-buddy` | |
| human | sheet-display epic | — | 协调 |
| claude-code | sheet-display-shell | `feature/sheet-display-shell-claude` | open |
| code-buddy | sheet-display-api | `feature/sheet-display-api-buddy` | open |
| kimi | sheet-display-tables-panel | `feature/sheet-display-tables-kimi` | blocked on shell |
| trae | sheet-display-univer | `feature/sheet-display-univer-trae` | blocked |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19、TanStack Router、Vite 6、Tailwind v4 |
| 后端 | Hono 4、better-sqlite3 |
| 数据源 | `gh` CLI、Firecrawl |
| 运行时 | Bun / Node 18+ |

## 里程碑

| 日期 | 里程碑 |
|---|---|
| — | 初始 MVP：trending + starred + 筛选 + 双模式 |
| — | 三栏 UI + 可折叠 Sidebar（[ui-layout](./issues/ui-layout.md) done） |
| 2026-07-06 | 控制平面元数据重构（index / spec / features / issues / tasks） |
