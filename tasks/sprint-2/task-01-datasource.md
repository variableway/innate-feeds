# T1：dsh datasource 抽离（backend/src/dsh/）

> Issue: 待建 · 依赖：R1（方案） · Sprint: [sprint-2](./context.md)

## 目标

把 dsh 目录的 datasource 从 feeds 后端文件中切出，收敛为独立模块树 `backend/src/dsh/`，**行为零变化**（API 响应、导出产物逐字段等价）。

| 迁入 | 来源 |
|---|---|
| `backend/src/dsh/catalog.ts` | `backend/src/data/plugin-catalog.ts`（原样迁移，含 DshPlugin 接口与搜索逻辑） |
| `backend/src/dsh/routes.ts` | `server.ts` 中 `/api/plugins`、`/api/plugins/stats`、`/api/plugins/categories`、`/api/plugins/:slug/related`、`/api/plugins/:slug` 五条路由 → Hono 子应用 |
| `backend/src/dsh/export.ts` | `export-incremental.ts` 中 plugins.json 导出切片（~20 行） |

接线：

- `server.ts`：`app.route("/", dshRoutes)`（或等价挂载），路由定义从 server.ts 删除。
- `export-incremental.ts`：改调 `dsh/export.ts` 的导出函数。
- shared import 路径随目录深度调整（`../../../shared/plugin-categories.js`）。

## 验收记录

- [x] `GET /api/plugins*` 五个端点响应与迁移前等价（对拍或单测覆盖 search/sort/pagination 参数）—— 2026-10-26 实测：stats(2716/20)、categories 计数、search（q/category/sort/page/perPage 组合）、detail、related、404 均正常
- [x] `bun run export:incremental` 产物含 `plugins.json`，条目数与迁移前一致 —— `exportPluginCatalog()` 临时目录实测导出 2716 条
- [x] `cd backend && bun run typecheck` 通过
- [x] `bun test` 通过（41/41）
- [x] `server.ts` 与 `export-incremental.ts` 中不再有 plugin catalog 逻辑（grep 验证：仅剩 `dshRouter` 挂载与 `exportPluginCatalog` 调用）
