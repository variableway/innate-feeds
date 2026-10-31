# Task log: awesome-dsh-plugin-update

Issue：[issues/awesome-dsh-plugin-update.md](../../issues/awesome-dsh-plugin-update.md)（源：GitHub #30）

## 2026-10-31 — done

- 调研上游：整仓 tarball 超时且 YAML 已膨胀到数千文件；上游站点发布约 3–4MB 的 format-1 market index，包含全部可列插件、分类、双语文案、npm 与发布时间。
- 确认 Stars 数据源：上游 `stars.json` 的 `checkedAt` 偏旧，因此补充 GitHub GraphQL；批次为 100 个 repo，已有 token 来自 `GH_TOKEN` / encrypted PAT / `gh auth token`。
- 实现 `awesome-dsh` collector 与 `~/.innate/awesome-dsh/plugin-catalog.json` 规范化存储；`/dsh` datasource 优先读本地目录，YAML 数据继续作为兼容 fallback。大体积收集数据不进 Git。
- 扩展 23 个上游分类；同步命令接入 daily/window Pages workflow，静态导出继续产出 `plugins.json`。
- 明确 Trendshift 增量语义：按 `(periodKey, fullName)` 合并当前期次，历史期次保存在同一个 slice 文件中。
- 刷新数据：3,992 个插件条目（覆盖 3,832 个仓库）、最新 Stars（3,807 个 GraphQL lookup 成功，25 个已删除/私有仓库跳过）；`bun run data:export` 后静态插件 JSON 同步。
- 验证：backend tests、backend/frontend/dsh typecheck、frontend build、真机同步与默认 Stars 排序。
