# T3：Admin DB API（简化版 SQLite 后台后端）

- **Issue:** https://github.com/variableway/innate-feeds/issues/9
- **依赖:** T1；调研输入 R1（相似度查询）、R2（JSON 查询）
- **分组:** admin 组（T3 → T4 / T5，本组优先级最高）
- **验收:** 见下。

## 任务描述

在 Hono（`backend/src/app/server.ts` 或独立子路由模块）下新增 `/api/admin/db/*`：

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/admin/db/tables` | 全部表 + 行数（含 FTS/内部表标记） |
| GET | `/api/admin/db/tables/:name/schema` | 列信息（PRAGMA table_info）+ 索引 + DDL |
| POST | `/api/admin/db/query` | 执行**只读** SQL，返回 `{ columns, rows, rowCount, durationMs }` |
| GET/POST | `/api/admin/db/queries` | 保存的 SQL：列表 / 新增 |
| PUT/DELETE | `/api/admin/db/queries/:id` | 保存的 SQL：更新 / 删除 |
| POST | `/api/admin/db/json/scan` | 扫描 JSON 目录（默认 `~/.innate`，`ADMIN_JSON_DIR` 可覆盖）→ 注册进内存表 `json_documents(path, name, content)` |
| GET | `/api/admin/db/json/files` | 已注册 JSON 文件清单 |

安全约束：

- 查询执行走**独立只读连接**（`new Database(path, { readonly: true })`），主连接不暴露给任意 SQL。
- 仅允许单条 SELECT / WITH 语句（拒绝多语句、PRAGMA、ATTACH 等）。
- 默认行数上限（如 500），防止全表拖垮 UI。
- 保存的 SQL 存 SQLite 表 `admin_saved_queries`。

JSON 查询按 R2 结论落地：`json_documents` 注册表 + `json_each` 展开示例。

## 验收记录

- [x] 上述端点全部可用（curl 验证：tables / schema / query / queries CRUD / json scan+files）
- [x] 只读约束生效（UPDATE 被拒 `Only SELECT / WITH statements are allowed`；多语句被拒；底层为 readonly 连接硬保证）
- [x] JSON scan 后可用 SQL 查询 JSON 内容（ADMIN_JSON_DIR 指向仓库根：233 文件 / 4.5MB；json_each 展开验证通过）
- [x] OpenAPI spec（backend/src/app/openapi.ts）同步更新（AdminDb tag + 7 端点 + 4 schema）
- [x] 单测：backend/src/app/admin-db.test.ts（validateReadOnlySql，`bun test` 7 pass；注：仓库 vitest 配置对 `with {type:"text"}` 导入存在既有问题，与本项目无关）
