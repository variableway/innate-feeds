# Issue: github-topics-datasource

**Status:** done（GH #24：GitHub Topic 数据源，edtech top 50，已存在则跳过但可查看）  
**Source:** [variableway/innate-feeds#24 get github tppic feeds](https://github.com/variableway/innate-feeds/issues/24)  
**Opened:** 2026-10-28 · **Assignee:** —  
**Feature:** —（外部数据源，见 [external-collectors](../../arch-design/external-collectors.md)）

## 背景

Issue #24 要求为 [github.com/topics/edtech](https://github.com/topics/edtech) 增加一个 topic 数据源：**只取 top 50**，且**已存在的仓库跳过**。

「已存在」按两类判定（用户确认）：仓库已在 trending/starred feeds 中，或该 topic 之前已采集过。但**跳过不等于丢弃**——点击某个 topic 时，被跳过的仓库仍要展示出来（标 `In feeds`），否则用户无法确认「这个 topic 里有什么」。

原仓已有 `backend/src/collector/github-topics.ts` 采集器，但只写单文件、只服务 admin JSON 工作区，前端完全看不到。

## 交付物

- [x] `backend/src/data/topics-store.ts` — topic 快照存储（`~/.innate/github-topics/topics/{topic}.json` + `index.json`）+ DTO 映射
- [x] `backend/src/collector/github-topics.ts` — 每 topic 取 top N（默认 50，`--limit` 可调）、分页采集、跳过规则（feeds 已存在 / 该 topic 已见过）、`firstSeenAt` 保留
- [x] `backend/src/db/index.ts` — `listKnownRepoFullNames()`（trending ∪ starred 的 full name 集合）
- [x] `backend/src/app/server.ts` + `openapi.ts` — `GET /api/topics`、`GET /api/topics/:topic`
- [x] `backend/src/app/cli.ts` — `sync github-topics [--topic T] [--limit N]`，输出每 topic 的 count / new / skippedExisting / skippedSeen
- [x] `backend/src/data/export-topics.ts` — 静态导出 `frontend/public/data/topics/`（`existing` 在导出时按 SQLite 解析）
- [x] 前端：`/topics`（topic 索引）+ `/topics/$topic`（完整列表，徽章 `New` / `In feeds`，topic 标签可点击跳转）、侧栏导航项、API/静态双模式 client
- [x] `backend/src/collector/github-topics.test.ts` — 6 个单测（跳过规则 / 存储往返 / 索引计数）
- [x] 文档：`docs/arch-design/external-collectors.md`、`AGENTS.md`（接口表 / 模块地图 / 命令）

## 语义

| 情况 | 判定字段 | 采集时 | 展示时 |
|------|----------|--------|--------|
| 已在 trending/starred | `existing`（实时读 SQLite） | 不计入 new | 保留，标 `In feeds` |
| 该 topic 之前采集过 | `firstSeenAt` < 本次同步 | 不计入 new | 保留 |
| 全新 | 以上皆否 | 计入 new | 标 `New` |

## 验证

- `bun test backend` 63/63 通过（含 6 个新单测）
- `bun run typecheck`（backend / frontend / dsh）全绿
- `bun run build`（frontend）通过
- 真机：`sync github-topics --topic edtech --limit 50` → count 50 / new 41 / skippedExisting 7；重复同步 → new 0 / skippedSeen 50
- 浏览器实测（headless Chrome 截图）：`/topics` 21 个 topic 卡片；`/topics/edtech` 50 条，含 `In feeds` 徽章与可点击 topic 标签

## 结论

Issue #24 已闭环：topic 数据源可采集、可查询、可浏览；「跳过」只影响新发现计数，不影响列表完整性。
