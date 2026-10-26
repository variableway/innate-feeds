# Sprint-1：项目初始化 + 数据导入 + 简化版 SQLite 后台

**来源 Issue:** https://github.com/variableway/innate-feeds/issues/4
**状态:** in_progress
**开始:** 2026-10-23
**状态总表:** [`status.md`](./status.md)（任何 Agent 完成任务后必须更新）

## Sprint 目标

1. 初始化当前项目（依赖安装、typecheck 通过、可启动）。
2. 更新最新数据，同步进本地 SQLite（`~/.innate/feeds.db`）。
3. 交付一个简化版 SQLite 后台工作台（admin workspace）：
   - 左侧：所有表（含行数）。
   - 中间上方：SQL 编辑区，支持 SQL 语法高亮；下方为查询结果表格。
   - 最右侧：保存的 SQL（加载 / 保存 / 删除）。
   - 支持相似度查询方案（如：查 tag 含 AI Agent 且 stars > 10000 的 GitHub repo）。
   - 支持对 JSON 文件的 SQL 查询（JSON 文件集中一处，SQL 查询文件内容，表格展示）。
   - 启动由参数控制，**默认启动后台管理查询**。

## 任务拆分与依赖

| Task | 文档 | GitHub Issue | 依赖 | 分组 |
|---|---|---|---|---|
| R1 相似度查询方案调研 | [research/similarity-query.md](./research/similarity-query.md) | #5 | 无 | research |
| R2 JSON 文件 SQL 查询方案调研 | [research/json-query.md](./research/json-query.md) | #6 | 无 | research |
| T1 项目初始化 | [task-01-init-project.md](./task-01-init-project.md) | #7 | 无 | 基础 |
| T2 数据同步进 SQLite | [task-02-sync-data.md](./task-02-sync-data.md) | #8 | T1 | 基础 |
| T3 Admin DB API | [task-03-admin-api.md](./task-03-admin-api.md) | #9 | T1、R1、R2 | admin 组 |
| T4 Admin UI 三栏工作台 | [task-04-admin-ui.md](./task-04-admin-ui.md) | #10 | T3 | admin 组 |
| T5 启动参数控制 | [task-05-server-flag.md](./task-05-server-flag.md) | #11 | T3 | admin 组 |

**独立性说明：**

- R1 / R2 / T1 互相独立，可由不同 Agent 并行认领。
- T2 依赖 T1（需要依赖安装完成），但只依赖 `bun install`，冲突面极小。
- T3 / T4 / T5 同属 **admin 组**，不是三个完全独立的功能：T3（API）是 T4（UI）与 T5（启动参数）的前置。优先级 T3 > T4 > T5；T4 与 T5 在 T3 完成后可并行。
- 所有新增 Issue 统一打 label `feeds-sprint-1`。

## 工作流（给执行 Agent 的约定）

1. 开始前先读 [`status.md`](./status.md)，确认目标 task 是否已被完成；**已完成则跳到下一个可做的 task**。
2. 认领：把 status.md 中对应行改为 `in_progress` 并写上 agent 名。
3. 调研类产出物放 [`research/`](./research/)；实现类改动直接进代码，但 task 文档的「验收记录」段落必须回填。
4. 完成后：task 文档勾选验收项 → status.md 置 `done` 并附提交 SHA → 有 GitHub Issue 的同时关闭 Issue。
5. 遇到阻塞不要空转：在 status.md 标 `blocked` 并写明原因，换下一个无依赖的 task。
6. 新增 task 时：新建 task 文档 + GitHub Issue（label `feeds-sprint-1`）+ 更新本文件任务表与 status.md。

## 相关背景

- 数据库：`~/.innate/feeds.db`（bun:sqlite，WAL），schema 见 `backend/src/db/schema.sql`；已有 FTS5 镜像表（`trending_repos_fts` / `starred_repos_fts`）可直接用于关键词查询。
- 后端：Hono 4（`backend/src/app/server.ts`），已挂 Swagger（`/docs`）。
- 前端：`@innate/domain-feeds` 域插件，TanStack Router 手动注册路由于 `frontend/src/web-domain.tsx`；构建走 Bun（`frontend/scripts/`），无 Vite。
- 外部 JSON 数据源：Product Hunt / YC / a16z / GitHub Topics 存于 `~/.innate/<source>/`（见 `docs/arch-design/external-collectors.md`），是 JSON 查询功能的数据面。
