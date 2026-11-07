# Epic: sheet-display（admin-data-sheet）

**Status:** open  
**Mode:** horizontal（父任务，跟踪子 issue）  
**Feature:** [admin-data-sheet](../features/admin-data-sheet.md)  
**Assignee:** human（协调）  
**Branch:** —（子 issue 各自分支）

## 背景

使用 [Univer](https://docs.univer.ai/) 以表格形式浏览 SQLite 后台数据。整体按**水平拆分**为 4 个子 issue，便于多 Agent 并行与交接。

## 范围（feature 级）

**做：** Sidebar 入口、中间表列表、Univer 主区域、只读 admin API、三栏与 ui-shell 一致。

**不做：**

- 静态 Pages 模式（见 [spec 非目标](../spec/README.md#非目标)）
- 表数据增删改、多用户鉴权
- 替代 trending/starred

## 子 Issue 与推荐顺序

```text
sheet-display-shell ──┬──► sheet-display-tables-panel ──► sheet-display-univer
                      │
sheet-display-api ────┘（tables-panel / univer 依赖合约，shell 可 mock）
```

| # | Issue | 建议 Assignee | 分支 | 状态 |
|---|---|---|---|---|
| 1 | [sheet-display-shell](./sheet-display-shell.md) | claude-code | `feature/sheet-display-shell-claude` | open |
| 2 | [sheet-display-api](./sheet-display-api.md) | code-buddy | `feature/sheet-display-api-buddy` | open |
| 3 | [sheet-display-tables-panel](./sheet-display-tables-panel.md) | kimi | `feature/sheet-display-tables-kimi` | open |
| 4 | [sheet-display-univer](./sheet-display-univer.md) | trae / claude-code | `feature/sheet-display-univer-*` | open |

**并行建议：** shell 与 api 可同时开工；tables-panel 在 api 合约定稿后接；univer 最后。

## Feature 验收（全部子 issue done 后勾选）

- [ ] Sidebar「后台数据」→ `/admin/data`
- [ ] 中间栏展示 SQLite 表列表并可选择
- [ ] 主区域 Univer 展示选中表数据（分页数据可加载）
- [ ] 三栏布局与 [ui-shell](../features/ui-shell.md) 一致

## 过程日志

本 epic 不记施工细节；各子 issue 见 [`tasks/issues/`](../tasks/issues/)。
