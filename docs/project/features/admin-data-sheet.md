# Feature: admin-data-sheet

**Status:** planned  
**Epic:** [sheet-display](../issues/sheet-display.md)  
**Issues:** shell → api ∥ tables-panel → univer

## 说明

在 **API 模式**下，用三栏布局浏览 SQLite 后台表：Sidebar 入口 → 中间表列表 → 主区域 Univer 表格。供本地调试与运营查看，不替代 trending/starred 主流程。

**非目标（MVP）：** 静态 Pages 模式、写操作、多用户鉴权。

## 子任务（水平拆分）

| 顺序 | Issue | 层 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | [sheet-display-shell](../issues/sheet-display-shell.md) | 路由 + Sidebar | 无 | open |
| 2 | [sheet-display-api](../issues/sheet-display-api.md) | 后端只读 API | 无 | open |
| 3 | [sheet-display-tables-panel](../issues/sheet-display-tables-panel.md) | 中间栏表列表 | api（可用 mock 先行） | open |
| 4 | [sheet-display-univer](../issues/sheet-display-univer.md) | Univer 主区域 | api + tables-panel | open |

## 对外接口

- [admin-tables-api-v1](../spec/contracts/admin-tables-api-v1.md)（api issue 落地后 active）

## 相关代码（预期）

- `frontend/src/pages/admin/` — 后台数据路由
- `frontend/src/components/app-sidebar.tsx` — 入口
- `backend/src/app/server.ts` — `/api/admin/*`
- `backend/src/db/` — 只读 introspection 查询

## 验收（feature 级）

- [ ] 四子 issue 均为 done
- [ ] `bun run dev` 下可完成：入口 → 选表 → Univer 展示数据
- [ ] 不破坏 [feeds-api-v1](../spec/contracts/feeds-api-v1.md)

## 变更记录

| 日期 | 变更 | Agent |
|---|---|---|
| 2026-07-06 | 拆分为 4 子 issue | human |
