# Issue: sheet-display-shell

**Status:** open  
**Mode:** horizontal  
**Feature:** [admin-data-sheet](../features/admin-data-sheet.md)  
**Assignee:** claude-code  
**Branch:** `feature/sheet-display-shell-claude`  
**Contract:** —

## 背景

为后台数据浏览增加路由与 Sidebar 入口，复用现有三栏壳（Sidebar / 中间 / 主内容），中间与主区域可先占位。

## 范围

**做：**

- Sidebar 增加「后台数据」导航项（图标 + 链接 `/admin/data`）
- 新增 `pages/admin/` 路由并注册到 `router.tsx`
- Admin 页三栏骨架：中间栏、主区域占位（「待接表列表 / Univer」）
- 仅 API 模式显示入口，或静态模式下隐藏/禁用并注明（见 spec）

**不做：**

- 不实现表列表 API 调用（留给 tables-panel）
- 不集成 Univer
- 不改 `/api/feeds` 行为

## 可改动的路径

- `frontend/src/components/app-sidebar.tsx`
- `frontend/src/pages/admin/`（新建）
- `frontend/src/router.tsx`
- `frontend/src/pages/__root/route.tsx`（若 admin 需独立布局再动）

**禁止改动：**

- `backend/`
- trending / starred 页面逻辑

## 验收标准

- [ ] Sidebar 可见「后台数据」，点击到达 `/admin/data`
- [ ] Admin 页呈现三栏布局，与 trending/starred 视觉一致（Sidebar 可折叠）
- [ ] 中间栏、主区域有明确占位文案或空状态
- [ ] `bun run typecheck`（frontend）通过

## 依赖

- 阻塞：无  
- 流水线上游：无

## 给下一 Agent

tables-panel 在中间栏挂载 `TableListPanel`；univer 在主区域挂载 sheet 组件。路由 path 保持 `/admin/data`。

## 过程日志

[`tasks/issues/sheet-display-shell.md`](../tasks/issues/sheet-display-shell.md)
