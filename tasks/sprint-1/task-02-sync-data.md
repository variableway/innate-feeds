# T2：最新数据同步进 SQLite

- **Issue:** https://github.com/variableway/innate-feeds/issues/8
- **依赖:** T1（`bun install` 完成）
- **验收:** 见下。

## 任务描述

用已认证的 `gh` CLI 把最新数据同步进 `~/.innate/feeds.db`：

1. `bun run data:sync:trending`（daily / weekly / monthly 三榜）。
2. `bun run data:sync:starred`（认证用户 star 全量，带 `starred_at`）。
3. `bun run data:stats` 与 `bun run dates` 确认快照日期为今天。

说明：digest（issues）与 README 预取不落 SQLite，属于 `sync window` 范畴，本 task 不强制；如执行可选 `--skip-readme`。

## 验收记录

- [x] `bun run data:sync:trending` 成功（daily 9 / weekly 15 / monthly 20，Firecrawl + gh 兜底）
- [x] `bun run data:sync:starred` 成功（增量 +1156，总计 6152）
- [x] `bun run data:stats` 显示今日快照（2026-10-23；total 7114 = trending 962 + starred 6152）