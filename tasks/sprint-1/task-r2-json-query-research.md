# R2：JSON 文件 SQL 查询方案调研

- **Issue:** https://github.com/variableway/innate-feeds/issues/6
- **依赖:** 无
- **产出物:** `tasks/sprint-1/research/json-query.md`
- **验收:** 文档对比多种"把 JSON 文件当表查"的方案（目标：所有 JSON 文件放一处，SQL 直接查文件内容、表格展示），给出 Sprint-1 推荐落地路径（本栈 = bun:sqlite + Hono）。

## 任务描述

调研对象包括：

1. SQLite JSON1 内置函数（`json_each` / `json_extract` / `->` / `->>`）。
2. "文件注册表"模式：把 `~/.innate/**/*.json` 扫描进 `(path, content)` 表再查询。
3. 外部引擎（DuckDB `read_json_auto`、Datasette / sqlite-utils）为何不引入本栈。

## 验收记录

- [x] 方案对比与推荐已写入 research/json-query.md
- [x] 推荐方案（json_documents 注册表 + json_each）已在真实数据上验证
