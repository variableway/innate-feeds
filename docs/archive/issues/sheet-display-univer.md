# Issue: sheet-display-univer

**Status:** open  
**Mode:** horizontal  
**Feature:** [admin-data-sheet](../features/admin-data-sheet.md)  
**Assignee:** trae  
**Branch:** `feature/sheet-display-univer-trae`  
**Contract:** [admin-tables-api-v1](../spec/contracts/admin-tables-api-v1.md)

## 背景

在 admin 页**主区域**用 [Univer](https://docs.univer.ai/) 展示选中表的分页数据。需先完成 shell、api、tables-panel。

## 范围

**做：**

- 引入 Univer 依赖（版本与许可在 task log 记录）
- 主区域组件：根据选中表名请求 `GET /api/admin/tables/:table`
- 将 JSON 行映射为 Univer sheet（列头 = 字段名）
- 未选表时 empty 状态；加载中与错误提示
- 大数据量：首屏遵守 `pageSize`（默认 50），可选「加载更多」或注明 MVP 仅首页

**不做：**

- 在线编辑、公式、写回数据库
- 静态 Pages 模式
- 中间栏表列表（tables-panel）

## 可改动的路径

- `frontend/src/pages/admin/`
- `frontend/src/components/`（univer 封装）
- `frontend/package.json`（Univer 依赖）

**禁止改动：**

- `backend/`（除非与 api issue 协调分页字段）
- feeds 相关页面

## 验收标准

- [ ] 选中表后主区域显示 Univer 表格，列与数据可见
- [ ] 切换表名会重新加载
- [ ] `bun run build`（frontend）通过；bundle 体积在 log 中注明
- [ ] Epic [sheet-display](./sheet-display.md) feature 级验收可勾选

## 依赖

- 阻塞：[sheet-display-shell](./sheet-display-shell.md)、[sheet-display-api](./sheet-display-api.md)、[sheet-display-tables-panel](./sheet-display-tables-panel.md)  
- 流水线上游：tables-panel（表名传递）、api（数据）

## 过程日志

[`tasks/issues/sheet-display-univer.md`](../tasks/issues/sheet-display-univer.md)
