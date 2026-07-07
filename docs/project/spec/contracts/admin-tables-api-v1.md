# Contract: admin-tables-api-v1

**Version:** v1.0-draft  
**Date:** 2026-07-06  
**Parties:** frontend admin UI ↔ backend `app/server.ts`  
**Issues:** [sheet-display-api](../issues/sheet-display-api.md)

> **Status:** draft — api issue 实现后改为 active，并与本文件对齐。

## 提供方承诺

### `GET /api/admin/tables`

返回可浏览的业务表名列表。

```json
{
  "tables": ["trending_repos", "starred_repos", "trending_repo_topics", "starred_repo_topics"]
}
```

- 不包含 `sqlite_*` 系统表
- 表名白名单由服务端维护，拒绝任意标识符

### `GET /api/admin/tables/:table`

Query：`page`（默认 1）、`pageSize`（默认 50，最大 200）

```json
{
  "table": "starred_repos",
  "columns": ["id", "name", "full_name", "stars"],
  "rows": [{ "id": 1, "name": "...", "full_name": "...", "stars": 100 }],
  "page": 1,
  "pageSize": 50,
  "total": 1234
}
```

- 未知表名 → `404`
- 非法参数 → `400`

## 消费方需求

- 仅 **API 模式**（`bun run dev`）调用；静态模式不请求这些端点
- tables-panel 用列表接口；univer 用分页接口

## 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0-draft | 2026-07-06 | 自 sheet-display 拆分 |
