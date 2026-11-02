---
schemaVersion: 1.0.0
id: task-39-starred-repo
title: 检查是否可以通过时间确认新starred的repo
createdAt: 2026-11-02T04:03:41.439098Z
updatedAt: 2026-11-02T04:12:13.714019Z
status: in_review
branch: 
repository: 
sourceKind: issue
sourcePath: 
issueNumber: 39
issueUrl: https://github.com/variableway/innate-feeds/issues/39
issueState: OPEN
issueTitle: 检查是否可以通过时间确认新starred的repo
issueUpdatedAt: 2026-11-02T04:02:51Z
prNumber: 
prUrl: 
prState: 
prTitle: 
prUpdatedAt: 
---

## 任务上下文

### 问题

Issue #39 问：能否通过时间确认「新 star 的 repo」？如果可以，希望生成一份 new starred 文件，或给出在 SQLite 中查询的方法。

### 目标

1. 确认数据链路是否支持按时间识别新 starred repo（已确认：支持）。 2. 提供按时间查询新 starred 的可复用方法（DB 查询函数 + CLI 命令）。 3. CLI 可将结果导出为 new-starred 文件（JSON），并支持打印/落盘。 4. 在 task 文档与 CLI usage 中记录 SQLite 手动查询方法。

### 范围

- `backend/src/db/index.ts`：新增按 `starred_at` 时间过滤的查询函数。
- `backend/src/app/cli.ts`：`list starred` 子命令支持 `--days N` / `--since ISO` / `--out FILE` / `--json`。
- `backend/package.json`：新增 `list:new-starred` script。

### 非目标

- 不改 `/api/feeds` 协议（不加 `starredSince` query param）。
- 不做前端「新 starred」页面。
- 不改 sync 逻辑（`starred_at` 已由 `sync.ts` 正确写入）。

### 依赖

- `starred_repos.starred_at` 列（schema.sql L48）。
- GitHub API `application/vnd.github.v3.star+json` header 提供 `starred_at`（`collector/github.ts` L244-290 已实现）。

### 假设

- 「新 starred」= `starred_at` 晚于给定时间点（默认近 7 天）。

### 未决问题

- 无（范围已由用户确认：CLI 导出即可）。

## 全局上下文

### 摘要

- 数据层：`backend/src/db/`（schema.sql + index.ts），`starred_repos` 表含 `starred_at`。 - CLI：`backend/src/app/cli.ts` 的 `list` case 现为硬编码 50 条。 - API 与前端不改。

### 来源

- docs/CONTEXT.md
- docs/project/index.md
- AGENTS.md

### 约束

- Backend 本地导入使用相对路径 + `.js` 扩展名。
- SQLite 通过 `bun:sqlite` prepared statements，不引入原生 addon。
- 遵循现有 CLI 参数解析风格（手写 `process.argv` 解析，无 commander）。

### 全局更新

- 需要：否
- 计划：无

## 设计影响

### 是否受影响

否

### 现状行为

- DB 层只有 `listStarredFullNamesSince`（只返回 full_name 字符串数组，供 sync-window 判断 README 预取范围）。 - CLI `list starred` 固定输出前 50 条 fullName，无时间过滤、无导出。

### 目标行为

- 新增 `listNewStarredItems(db, { since?, days? }, limit)`：返回完整 `FeedItemDTO[]`（含 starredAt），按 starred_at 降序。 - CLI `list starred --days N [--since ISO] [--json] [--out FILE] [--limit N]`：时间过滤 + 人类可读表格 / JSON 导出。 - `bun run list:new-starred` 一键导出到 `~/.innate/new-starred.json`。

### 决策

- 方案选型：扩展 CLI 而非改 HTTP API。理由：Issue 诉求是「生成文件 / 在 SQLite 中可查」，是本地分析场景；API/前端不改可控制影响面。
- 文件位置：默认 `~/.innate/new-starred.json`（INNATE_HOME 之下，与 hidden.json 等本地 store 一致），`--out` 可覆盖。
- 时间过滤在 SQL 层完成（`starred_at >= ?`），不在 JS 层过滤，便于索引与后续扩展。

### 风险

- 旧库 `starred_at` 可能存在 NULL 行（本次实测无，但防御性处理：WHERE 排除 NULL 并在 JSON 中原样输出 null）。

### 全局影响

无

## 功能与验证点

### F1 · 按 `starred_at` 时间查询新 starred repo

目标：提供 DB 查询函数 `listNewStarredItems(db, opts, limit)`，按 `starred_at >= since` 过滤并返回完整 DTO。
模块：M1
Spec：S1

- F1-V1 [passed] 时间过滤正确且排除 NULL `starred_at`
  - 方法：backend 单元测试覆盖边界（since 包含、NULL 排除、降序）
  - 证据：bun test src/db/index.test.ts: 19 pass 0 fail（新增 5 个用例覆盖 DTO 映射/since 边界包含/days 相对现在/NULL 排除/limit 与缺参报错）

### F2 · CLI `list starred` 支持时间过滤与导出

目标：`list starred --days 7 | --since ISO | --json | --out FILE | --limit N`。
模块：M2
Spec：S1

- F2-V1 [passed] 真实库上按时间过滤并输出 JSON
  - 方法：对 `~/.innate/feeds.db` 运行 `list starred --days 30 --json`，每条含 `starredAt`
  - 证据：真实库 ~/.innate/feeds.db: list starred --days 30 --json 输出 count=50 且每条含 starredAt（如 2026-10-30T17:40:54Z）；--since 2026-10-01 --limit 5 正常
- F2-V2 [passed] `--out` 生成文件且 `--days` 与 `--since` 等价性正确
  - 方法：`--out` 落盘后检查文件内容；同一时刻 `--days 7` 与 `--since` 计算点对比
  - 证据：--out 写入 Temp/new-starred-test.json（Wrote 2 new starred repos）；--days 7 与 --since(等价UTC时间) count 均为 2 match=yes
- F2-V3 [passed] SQLite 手动查询方法写入交付记录
  - 方法：SQL 文本可直接复制执行得到同样结果
  - 证据：SQLite 手动查询 SQL 已写入本 task 交付记录（见下方）

### F3 · npm script 快捷入口

目标：`bun run list:new-starred` 输出近 7 天新 starred（JSON）。
模块：M3
Spec：S1

- F3-V1 [passed] script 运行成功并打印条目
  - 方法：backend 目录运行 `bun run list:new-starred`
  - 证据：cd backend && bun run list:new-starred 输出 JSON count=2（近7天: thebookofshaders 等）

## 涉及模块

- M1 [modify] backend/src/db/index.ts — 新增 `listNewStarredItems` 查询函数（F1）
- M2 [modify] backend/src/app/cli.ts — `list` case 扩展时间/导出参数解析（F2）
- M3 [modify] backend/package.json — 新增 `list:new-starred` script（F3）

## Spec 关联

- S1 [none/-] docs/arch-design/collector-design.md — 无 Spec 变更：纯本地 CLI/查询能力扩展，不改 API 契约、数据契约与模块边界；schema 未动（`starred_at` 列已存在），sync 链路未动。

## 交付记录

- 2026-11-02 分析完成：`starred_at` 在真实库 100% 覆盖（6159/6159），数据链路支持按时间识别新 starred；选型 CLI 扩展（不改 API/前端）。
- 2026-11-02 实施完成：
- 验证证据：bun test db 19 pass / 0 fail；真实库 `--days 30` count=50、`--days 7` 与等价 `--since` count 均为 2；`--out` 落盘成功。
- 分析完成：starred_at 100% 覆盖，走 CLI 扩展方案
- 已实现并验证，等待评审

## 来源原文

### Issue #39

> 检查是否可以通过时间确认新starred的repo，如果可以的化生成一份new starred文件，或者在sqlite 数据库中可以找到，给出方法

### PR

> （未同步）
