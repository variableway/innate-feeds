# task-A1：collectors 任务注册表 + 单任务 CLI + M-Sync 边界固化

## 计划（开工前）

- 做什么：新增 `backend/src/collectors/jobs.ts` 任务注册表（每个采集器一条记录：id/组/命令/产出/调度）；`cli sync jobs` 列出全部、`cli sync job <id>` 执行单个；AGENTS.md 写入 M-Sync 边界禁令（server 不 import collectors，grep 可验证）。
- 功能点：①注册表为代码级单一事实源（≈20 个 job）②`sync jobs` / `sync job <id>` 两个新命令 ③既有原子命令全部保留兼容 ④server 零改动、API 行为不变 ⑤每个 job 可脱离 server 独立运行。
- 如何验证：`bun src/app/cli.ts sync jobs` 输出全表；任选 3 个轻量 job 实跑（hackernews/devto/lobsters，秒级网络任务）+ 1 个 SQLite 增量 job（starred:recent）确认落盘；`grep -rn "collectors/" backend/src/app/server.ts` 为空（边界禁令）；typecheck + bun test 绿；`curl /api/external/hackernews` 返回新快照数据。

## 完成回填（完成后）

- 做了什么：新增 `backend/src/collectors/jobs.ts` 注册表（19 个 job：core 4 / external 10 / topics 1 / vertical 3 / pipeline 2）；从 `app/cli.ts` 抽取 `runSync(syncArgs)` 并新增 `sync jobs`（列表）与 `sync job <id>`（单任务分发）两个命令，既有原子命令全保留；`server.ts` 三处 collectors import 加边界注释；AGENTS.md 写入注册表说明与 M-API/M-Sync 边界规则。
- 完成的功能：①每个采集器可通过 `cli sync job <id>` 独立运行（脱离 server）②注册表为新增采集器的登记点 ③serve 服务零改动照常提供同样数据 ④边界禁令成文（写路径禁止 + 两个只读白名单例外）。
- 验证证明：`bun src/app/cli.ts sync jobs` 输出 19 行（见命令输出）；实跑 4 个 job——hackernews/devto/lobsters 落盘 `~/.innate/*/2026-11-07.json`（mtime 16:08:39）、starred-recent 增量正常停；`curl :4000/api/external/hackernews` 返回 label=2026-11-07 新快照（serve 不变）；typecheck 绿；`bun test src` 102 通过 0 失败。提交 **793e6ea**。
- 偏差记录：任务原验证口径「grep server.ts 无 collectors 引用为空」基于 module-partition 文档「现状已满足」的错误假设；实测 3 处（sync 手动触发 / README 回源 / trendshift 切片），处置为注释标注 + 白名单成文，迁移至 data/ 留待 S 系列（已在 AGENTS.md 记）。
