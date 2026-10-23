# T4：Admin UI 三栏工作台

- **Issue:** https://github.com/variableway/innate-feeds/issues/10
- **依赖:** T3（API 就绪）
- **分组:** admin 组；与 T5 可并行
- **验收:** 见下。

## 任务描述

前端新增 `/admin` 路由页（`frontend/src/pages/admin/`，注册进 `frontend/src/web-domain.tsx` 与 navItems）：

```
┌──────────┬──────────────────────────────┬────────────┐
│ 表列表    │ SQL 编辑器（语法高亮）          │ 保存的 SQL  │
│ (行数)   │ ────────────────────────────  │ (点击加载)  │
│ 点击预览  │ 结果表格（列名 + 行数据）        │ 保存/删除   │
└──────────┴──────────────────────────────┴────────────┘
```

- SQL 编辑器：CodeMirror 6（`@uiw/react-codemirror` + `@lang-sql`），需确认与 Bun 构建链兼容。
- 左栏：`GET /api/admin/db/tables`，点击表名自动填充 `SELECT * FROM x LIMIT 100`。
- 右栏：保存的 SQL 列表（加载 / 覆盖保存 / 删除）；内置 R1 结论的示例查询（AI Agent + stars>10000）。
- 结果：表格渲染，显示 rowCount 与耗时。

## 验收记录

- [x] `/admin` 页面可用（生产构建产物由后端同源托管验证 200；dev 模式同 pipeline）
- [x] SQL 高亮、执行、结果表格正常（CodeMirror 6 `@uiw/react-codemirror` + `@codemirror/lang-sql`；新版无需独立 CSS 文件，运行时注入主题）
- [x] 保存的 SQL 增删改查正常（覆盖保存 / 另存 / 删除；Ctrl+Enter 执行）
- [x] typecheck 通过
- 备注：修复 server.ts `mountWebsite` 在 Windows 上因反斜杠路径前缀校验失败导致所有页面路由 404 的既有 bug（`toPosix` 归一化）。
