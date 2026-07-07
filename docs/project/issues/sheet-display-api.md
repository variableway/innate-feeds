# Issue: sheet-display-api

**Status:** open  
**Mode:** horizontal  
**Feature:** [admin-data-sheet](../features/admin-data-sheet.md)  
**Assignee:** code-buddy  
**Branch:** `feature/sheet-display-api-buddy`  
**Contract:** [admin-tables-api-v1](../spec/contracts/admin-tables-api-v1.md)

## 背景

前端表列表与 Univer 需要只读 API 列举 SQLite 表名并分页返回行数据。合约见 `spec/contracts/admin-tables-api-v1.md`。

## 范围

**做：**

- `GET /api/admin/tables` — 返回可浏览表名列表（排除 sqlite 内部表或仅暴露业务表，在合约中写明）
- `GET /api/admin/tables/:table` — 分页查询（`page`, `pageSize`），JSON 行列
- 在 `backend/src/db/` 增加只读 introspection / 安全查询（参数化表名白名单）
- Zod 校验 query；错误 JSON 与现有 API 风格一致

**不做：**

- POST/PUT/DELETE
- 生产环境暴露策略（MVP 假定本地 dev；与 sync API 同样不对外公开）
- 修改 `feeds-api-v1` 端点

## 可改动的路径

- `backend/src/app/server.ts`
- `backend/src/db/index.ts`（或新建 `admin-queries.ts`）

**禁止改动：**

- `schema.sql` 结构变更（除非 issue 单独立项）
- `frontend/`

## 验收标准

- [ ] `GET /api/admin/tables` 返回至少 `trending_repos`、`starred_repos` 等表名
- [ ] `GET /api/admin/tables/starred_repos?page=1&pageSize=50` 返回行数组 + 总数（或 hasMore）
- [ ] 非法表名返回 400/404，无 SQL 注入
- [ ] 合约文档与实现一致，标为 active
- [ ] `bun run typecheck`（backend）通过

## 依赖

- 阻塞：无  
- 流水线上游：无

## 给下一 Agent

tables-panel 消费 `/api/admin/tables`；univer 消费 `/api/admin/tables/:table`。字段名以合约为准。

## 过程日志

[`tasks/issues/sheet-display-api.md`](../tasks/issues/sheet-display-api.md)
