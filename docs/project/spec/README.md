# Spec: Innate Feeds

> 事实来源：本仓库 · [GitHub `variableway/innate-feeds`](https://github.com/variableway/innate-feeds)

## 问题

统一查看 GitHub Trending 与个人 Starred，支持筛选、快照历史；可本地开发或静态发布。

## MVP 范围

- Trending：日/周/月快照、历史日期
- Starred：`starred_at`、增量同步
- 筛选：语言、topic、搜索、日期、stars、排序
- 双模式：API+SQLite / 静态 JSON + GitHub Pages（快照 + 浏览器 live GitHub）
- 多主题、筛选 localStorage 持久化
- CI + 定时数据流水线（`data:update`；完整 90 日窗口用 `data:update:window`）

## 非目标

- 多用户鉴权（sync API 不对外暴露）
- `git-repo-scanner` 深度集成
- 懒猫私有云生产部署（仅 Docker 草案）
- **admin 数据表（Univer）在静态 Pages 模式** — 仅 API 本地开发模式（见 [admin-data-sheet](../features/admin-data-sheet.md)）

## 验收标准

- [x] `bun run dev` 可浏览 trending / starred
- [x] `bun run data:update` 更新静态 JSON（含近 90 日 digest）
- [x] `bun run data:update:window` 近 90 日 starred/digest/README 预取
- [x] CI：test + typecheck + build
- [x] GitHub Pages 部署 workflow
- [ ] [sheet-display](../issues/sheet-display.md) 后台 SQLite 浏览
- [ ] 生产 API 模式 + CORS 收紧文档

## 技术约束

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 4000 | API |
| `DB_PATH` | `~/.innate/feeds.db` | SQLite |
| `VITE_STATIC_MODE` | — | 静态前端 |
| `VITE_BASE_PATH` | `/` | Pages 子路径 |

## 相关文档

- [conventions.md](./conventions.md) — 代码与文档写作规范  
- [architecture.md](./architecture.md) — 架构与 ADR  
- [contracts/](./contracts/README.md) — 跨模块接口约定  

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-07-06 | 迁入 `spec/README.md` 目录结构 |
