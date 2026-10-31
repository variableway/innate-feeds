# Product Hunt 采集器返回 0 条且无报错

> [GH #33](https://github.com/variableway/innate-feeds/issues/33) · 2026-10-31 · status: open

## 现象

`bun run data:update:local`（2026-10-31）中 Product Hunt 源抓到 0 条且无报错，其余外部源正常。怀疑 Firecrawl extraction schema 不再命中 PH 页面（或反爬返回空壳页），HTML fallback 同样为空；采集器对 0 条不告警，`saveItems` 会静默写空快照。

## 临时处理

`data:sync:external`（root package.json，Orca 每日编排调用）已改为显式 `--source` 列表，暂排除 producthunt；backend `sync:vc` / CI 仍为全量。

## 修复方向

1. 排查 Firecrawl / HTML fallback 哪条路径失效并修复解析
2. 0 条结果至少输出 warning（区分「榜单未生成」与「抓取失败」）
3. 修复后在 `data:sync:external` 恢复 `--source producthunt`
