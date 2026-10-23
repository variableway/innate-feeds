# R1：相似度查询方案调研

- **Issue:** https://github.com/variableway/innate-feeds/issues/5
- **依赖:** 无
- **产出物:** `tasks/sprint-1/research/similarity-query.md`
- **验收:** 文档给出至少 3 种可落地的查询方案，含可直接在 `~/.innate/feeds.db` 上执行的示例 SQL（示例场景：tag 含 AI Agent 且 stars > 10000 的 GitHub repo），并给出 Sprint-1 推荐组合。

## 任务描述

调研在本仓现有 SQLite（bun:sqlite，schema 见 `backend/src/db/schema.sql`）上实现"相似度查询"的方案，覆盖：

1. 精确 tag + 数值阈值（`starred_repo_topics` join `starred_repos`）。
2. 关键词模糊匹配：`LIKE`、FTS5（库中已有 `*_fts` 镜像表）。
3. 更高级相似度（编辑距离 / trigram / 向量）在本栈的可行性与成本。

## 验收记录

- [x] 方案对比与推荐已写入 research/similarity-query.md
- [x] 示例 SQL 已在实际数据库上验证执行
