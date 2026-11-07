# Issue: sheet-display-tables-panel

**Status:** open  
**Mode:** horizontal  
**Feature:** [admin-data-sheet](../features/admin-data-sheet.md)  
**Assignee:** kimi  
**Branch:** `feature/sheet-display-tables-kimi`  
**Contract:** [admin-tables-api-v1](../spec/contracts/admin-tables-api-v1.md)

## 背景

在 admin 页**中间栏**展示 SQLite 表列表，选中一项后把表名交给主区域（Univer issue）。依赖 shell 路由与 admin API。

## 范围

**做：**

- 组件 `TableListPanel`（或等价命名）：拉取 `GET /api/admin/tables`，列表展示
- 选中态：高亮当前表，通过 URL search `?table=` 或 React state 向上/向兄弟传递
- Loading / empty / error 状态
- API 未就绪时可用静态 mock，合并前须切到真实 API

**不做：**

- Univer 渲染
- 后端 API 实现（见 sheet-display-api）
- 改 Sidebar / 路由注册（见 shell）

## 可改动的路径

- `frontend/src/pages/admin/`
- `frontend/src/components/`（新建 table-list 相关）
- `frontend/src/services/`（可选 `admin.ts` 客户端）

**禁止改动：**

- `backend/`
- `app-sidebar.tsx`（除非与 shell PR 冲突，应基于 shell 合并后再做）

## 验收标准

- [ ] 中间栏展示数据库表列表
- [ ] 点击表项后选中态明确，且表名可被主区域读取（document 传递方式）
- [ ] 与 [admin-tables-api-v1](../spec/contracts/admin-tables-api-v1.md) 响应格式一致
- [ ] `bun run dev` + 本地 API 可手动验证

## 依赖

- 阻塞：[sheet-display-shell](./sheet-display-shell.md)（路由与布局）  
- 合约：[sheet-display-api](./sheet-display-api.md)（可先 mock，合并前对接）  
- 流水线上游：shell

## 给下一 Agent

univer issue：读当前选中 `table` 名，调用 `GET /api/admin/tables/:table` 加载数据。

## 过程日志

[`tasks/issues/sheet-display-tables-panel.md`](../tasks/issues/sheet-display-tables-panel.md)
