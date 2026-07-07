# Innate Feeds

**Status:** active  
**Updated:** 2026-07-06

## Agent 入口（每次会话先读）

1. 本文件 → 当前焦点与链接  
2. [`issues/`](./issues/README.md) 中 **Assignee** 或状态为 open/in_progress 的条目  
3. 对应 [`tasks/issues/`](./tasks/issues/) 日志**最后一条**

## 快速导航

| 文档 | 说明 |
|---|---|
| [overview.md](./overview.md) | 全景、约束、Agent 分工 |
| [spec/README.md](./spec/README.md) | PRD、双模式、验收 |
| [spec/conventions.md](./spec/conventions.md) | 代码规范 |
| [spec/architecture.md](./spec/architecture.md) | 架构要点 |
| [spec/contracts/](./spec/contracts/README.md) | 跨模块接口约定 |
| [features/](./features/README.md) | 功能模块 |
| [issues/](./issues/README.md) | 任务契约 |
| [tasks/](./tasks/README.md) | 多 Agent 工作流 |

## 当前焦点

**Epic：** [sheet-display](./issues/sheet-display.md)（admin-data-sheet）

| Issue | Assignee | 状态 | 依赖 |
|---|---|---|---|
| [sheet-display-shell](./issues/sheet-display-shell.md) | claude-code | open | — |
| [sheet-display-api](./issues/sheet-display-api.md) | code-buddy | open | — |
| [sheet-display-tables-panel](./issues/sheet-display-tables-panel.md) | kimi | open | shell, api |
| [sheet-display-univer](./issues/sheet-display-univer.md) | trae | open | shell, api, tables-panel |

- [ ] 确认 GitHub Pages 线上 URL，写入 [overview.md](./overview.md)

## 代码

| | 链接 |
|---|---|
| 仓库根目录 | [`/`](../)（本仓库） |
| GitHub | https://github.com/variableway/innate-feeds |

`innate-works` registry：`projects/innate-feeds/index.md`

## 仓库根配置

薄层 [`AGENTS.md`](../../AGENTS.md) / `CLAUDE.md` 指向本目录；项目事实不在根配置重复。
