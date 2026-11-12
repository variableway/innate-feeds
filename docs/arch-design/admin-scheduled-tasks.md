# 定时任务管理（Admin Tasks）— 设计与非分期计划

> 基线：2026-11-12（issue #70 已交付的调度是「每 N 分钟」的简单 interval）。
> 本文档分两部分：**现状与已落地改动**（§1–§2）与 **定时任务管理目标模型 + 分阶段计划**（§3–§9）。
> 相关代码：`backend/src/app/task-runner.ts`、`backend/src/app/admin-tasks.ts`、
> `backend/src/data/task-runs-store.ts`、`admin/src/pages/tasks/page.tsx`。

## 1. 现状（as-is）

| 维度 | 现状 |
|---|---|
| 注册表 | `backend/src/collectors/jobs.ts` 的 `SYNC_JOBS`，当前 **21 个 job**（core 4 / external 9 / topics 1 / vertical 4 / pipeline 3） |
| 调度模型 | 每 job 一条 `{ enabled, everyMinutes(5–10080) , lastStartedAt }`，落在 `$INNATE_HOME/admin/tasks/schedules.json` |
| 触发判定 | 后端进程内 30s tick：`now - lastStartedAt >= everyMinutes * 60_000` 即启动（`isScheduleDue`） |
| 执行方式 | 子进程 `bun src/app/cli.ts sync job <id>`，stdout+stderr 合并写 `logs/<runId>.log` |
| 重叠控制 | 同一 job 内存态去重（`runningByJob`）；**本轮新增全局并发上限 4**（`MAX_CONCURRENT_RUNS`） |
| 中断恢复 | 服务启动时把遗留 `running` 记录标记为 `interrupted`（`markInterruptedRuns`） |
| 保留策略 | `runs.json` 最多 200 条；日志读取截断 200KB；日志文件本身不清理 |
| 入口 | `/admin/tasks`：单 job 运行/取消/日志、运行历史、每 job 调度对话框；**本轮新增按分组/勾选批量启动与实时日志** |

**已知边界**：调度只在本机后端进程存活时生效；没有 cron、时区、依赖编排、错过补跑、下次运行时间预测、失败通知；停服期间到期的调度不会补。

## 2. 本轮已落地（P0，2026-11-12）

1. **批量/一键启动**：`POST /api/admin/tasks/jobs/run-batch`，body `{ jobIds?: string[], group?: SyncJobGroup }`；
   逐条返回 `{ jobId, run?, error? }`，已运行 / 未知 job / 超并发只在对应条目上失败，不阻断其它任务。
   UI 提供「按分组启动」5 个分组按钮 + 表格勾选 +「运行所选」。
2. **并发上限**：全局最多 4 个子进程同时运行（`MAX_CONCURRENT_RUNS`）；`GET /jobs` 返回 `runningCount` / `maxConcurrent` 供页面提示。
3. **单任务实时日志**：任务名 / 最新运行状态可点击 → 打开该 job **当前运行（运行中优先，否则最近一次）** 的日志；
   对话框对运行中任务每 2s 轮询并自动跟随底部（用户上翻后停止跟随）。
4. **文档**：本文档。

### 2.1 DB 标签分组（2026-11-12 追加）

任务分组不再依赖代码里的 `group` 常量，改为 SQLite 表驱动：

| 表 | 内容 |
|---|---|
| `task_tags` | 标签字典：`slug` / `label` / `sort_order`，当前四个：`github` / `dsh` / `topics` / `news` |
| `task_job_tags` | `job_id` ↔ `tag_id` 多对多（`job_id` = `SYNC_JOBS.id`） |

- **播种**：`backend/src/data/task-tags-store.ts` 的 `DEFAULT_JOB_TAGS` 在表为空时写入默认映射
  （github 8 / dsh 1 / topics 4 / news 8 = 21 个任务）；之后**以库为准**，不会覆盖手工修改。
- **维护**：后台 SQLite 工作台直接增删 `task_job_tags`（或 `PUT /api/admin/tasks/jobs/:id/tags`）即生效。
- **读取**：`GET /api/admin/tasks/jobs` 每个 job 返回 `tags: [{slug,label}]`，顶层返回标签字典 + 计数。
- **批量**：`POST /api/admin/tasks/jobs/run-batch` 支持 `{ tag }`，按标签取该组全部任务。
- **UI**：任务表按主标签（`sort_order` 最小的标签）分组排列，分组行显示「标签 · N 个任务 · M 运行中」；
  行内仍展示该任务的全部标签；批量工具栏为每个标签提供一键启动。
- 测试：`backend/src/data/task-tags-store.test.ts` + `backend/src/app/admin-tasks.test.ts`
  （顺带修复 `INNATE_HOME` 在模块加载时被冻结导致测试写到真实库的隔离缺陷，见 `backend/src/db/paths.ts`）。

验收（已通过）：typecheck（backend + admin）通过；`run-batch` 未知 job → 409 + 条目错误，空 body → 400；
真实批量启动 `hackernews` + `lobsters` → 两条 `success`、日志可读。

## 3. 目标模型（to-be）

### 3.1 调度表达式

| 形态 | 字段 | 说明 |
|---|---|---|
| 间隔（兼容现状） | `kind: "interval"`, `everyMinutes` | 5–10080 分钟，保持旧数据/旧 UI 语义 |
| 日历 | `kind: "cron"`, `cron: "分 时 日 月 周"` + `timezone` | 5 字段、最短 5 分钟粒度（不支持秒级）；默认 `Asia/Shanghai` |
| 一次性 | `kind: "once"`, `runAt` | 临时补采/一次性任务（可选） |

- 计算一律用「表达式 + 时区 → 下一次触发时刻」，**不再依赖 `lastStartedAt` 差值**；
  `nextRunAt` 在 `GET /schedules` 时即时计算并返回，UI 直接展示。
- 时间推进要看 **计划时刻** 而不是「上次启动时刻」：手动运行不应推迟下一次定时（现状 `lastStartedAt` 会被手动运行重置，是已知偏差）。

### 3.2 触发语义（关键决策）

| 语义 | 取值 | 默认 | 说明 |
|---|---|---|---|
| 重叠策略 `overlapPolicy` | `skip` / `queue` / `replace` | `skip` | 上次未结束时：跳过本次 / 排队一次（上限 1）/ 杀掉重跑（仅危险 job 显式开启） |
| 补跑策略 `catchUpPolicy` | `none` / `once` / `window` | `none` | 停服期间错过的触发：不补 / 补一次 / 窗口内按上限补（如每 6h，最多补 4 次） |
| 抖动 `jitterSeconds` | 0–300 | 0 | 整点类 cron 错峰，避免多源同一秒打满 API |
| 并发 `maxConcurrent` | 全局 4（已有）+ 分组上限 | 全局 4 | 同源 job（Firecrawl / GitHub Search）建议串行 |
| 失败策略 `onFailure` | `continue` / `abortPipeline` | `continue` | 仅流水线 job 有意义 |

### 3.3 依赖与流水线

`SYNC_JOBS` 的 `pipeline` 组（`window` / `vc-external` / `hot`）本质是编排，建议升级为一等模型：

```jsonc
{
  "id": "daily-refresh",
  "kind": "pipeline",
  "steps": ["trending-daily", "starred-recent", "hot"],
  "onFailure": "continue"
}
```

- `steps` 串行执行；每步复用现有 run 记录（`jobId` 记录为 `daily-refresh/step` 或增加 `parentRunId`）。
- 只允许 **DAG**（禁止环），提交时校验；`dependsOn` 用于非流水线的一对一依赖（如 `hot` 依赖 trending/github-new 当日数据）。

### 3.4 执行边界（明确不做）

- **单写者**：调度仍只跑在持有 `schedules.json` 的本机后端进程内；不做分布式调度 / 多实例选主（改为外部 cron + CLI 是另一条路径，见 §9 决策）。
- 调度器不进入 API 请求路径；启动子进程的约束不变（见 `task-runner.ts` 头注的 M-API 例外）。
- 不引入消息队列、不做秒级精度、不做跨机器共享状态。

### 3.5 可观测性

- `GET /schedules` 返回 `nextRunAt` / `lastStartedAt` / `lastFinishedAt` / 最近结果。
- `GET /api/admin/tasks/health`（新增）：`{ running, staleRuns, failingJobs, schedulesEnabled, nextDue }`，页面顶部一条横幅。
- 失败通知：P3 可选 webhook（`TASKS_WEBHOOK_URL`），payload 复用 `TaskRun` + 日志尾部 2KB；不做邮件/短信。
- 保留策略：`runs.json` 全局 500 条或 90 天（先到者），每 job 保留最近 50 条；日志文件按 7 天 / 单文件 5MB 轮转清理（当前只有读取截断）。
- 运行历史支持 `?jobId=&trigger=&status=&since=` 过滤（现仅 `jobId`/`limit`）。

## 4. 数据模型 v2（向后兼容）

```jsonc
{
  "version": 2,
  "timezone": "Asia/Shanghai",
  "schedules": [
    {
      "jobId": "hackernews",
      "kind": "interval",              // "interval" | "cron" | "once"
      "everyMinutes": 30,              // kind=interval 时必填
      "cron": null,                    // kind=cron 时必填，如 "0 */6 * * *"
      "timezone": null,                // 省略则继承顶层默认
      "overlapPolicy": "skip",
      "catchUpPolicy": "none",
      "jitterSeconds": 0,
      "enabled": true,
      "lastStartedAt": "2026-11-11T19:38:52.327Z",
      "lastFinishedAt": "2026-11-11T19:38:53.882Z"
    }
  ]
}
```

**迁移**：读到 v1（无 `version`）时，把 `{ enabled, everyMinutes, lastStartedAt }` 映射为 `kind: "interval"`，
未知字段忽略；首次写入时补 `version: 2` 并留 `schedules.v1.bak.json`。读取器同时接受 v1/v2，避免半迁移状态炸掉旧页面。

`nextRunAt` **不落盘**（每次计算），避免进程停摆期间写入过期值。

## 5. API 变更

| 方法 | 路径 | 变更 |
|---|---|---|
| GET | `/api/admin/tasks/schedules` | v2 字段 + `nextRunAt`；兼容返回 v1 字段（`everyMinutes`） |
| PUT | `/api/admin/tasks/schedules/:jobId` | body 扩展 `kind` / `cron` / `timezone` / `overlapPolicy` / `catchUpPolicy` / `jitterSeconds`；Zod 校验（cron 用解析器试算下一次） |
| POST | `/api/admin/tasks/jobs/run-batch` | 已实现（P0）；支持 `{ jobIds }` / `{ group }` / `{ tag }`；P1 增加 `{ dryRun: true }` 返回将启动的清单 |
| GET | `/api/admin/tasks/tags` | 标签字典 + 每标签任务数（DB 驱动） |
| PUT | `/api/admin/tasks/jobs/:id/tags` | 覆盖式设置任务标签（未知 slug → 400） |
| GET | `/api/admin/tasks/health` | 新增聚合健康 |
| POST | `/api/admin/tasks/schedules/stop-all` | 新增「全部停止」：取消运行中子进程 + 关闭全部调度 |
| GET | `/api/admin/tasks/runs` | 新增 `trigger` / `status` / `since` 过滤 |

cron 解析建议引入 `cron-parser`（纯 JS、支持 IANA 时区、无 native 依赖，`bun` 可直接跑）；
备选自写 5 字段解析器，但要自己承担 DST/月末边界测试，不划算。

## 6. UI 变更

1. **调度页独立 Tab**（现为每行弹窗）：表格列 = 任务 / 表达式（interval 或 cron） / 时区 / 下次运行 / 上次结果 / 开关 / 操作；
   行内直接切换启停，表达式出错时即时校验提示。
2. **批量编辑**：多选后统一设置（如「全部改为每 6 小时」），避免 21 个 job 逐个点。
3. **分组模板**：`core` 每日、`external` 每小时、`pipeline` 每日一次等预设一键应用。
4. **健康横幅**：失败任务数、下一次到期任务、停服补跑提示；一键「全部停止」（运维刹车）。
5. **运行历史过滤**：job / 触发 / 状态 / 时间范围，失败行直接跳日志。
6. 现有表单里的「间隔」保留，增加「按 cron 配置」切换（同一 job 二选一）。

## 7. 分阶段计划

### P0 — 已交付（2026-11-12）
- 批量启动 API + UI（分组 / 勾选）
- 全局并发上限 4
- 单任务实时日志（运行中优先、2s 刷新、跟随底部）
- 本文档

**验收**：类型检查通过；`run-batch` 边界（未知 job / 空 body / 部分成功）行为正确；真实批量 2 job 成功。

### P1 — 调度表达式与可观测（预计 1–2 天）
1. `JobSchedule` v2 类型 + 读写兼容 + 迁移（`task-runs-store.ts`）
2. `cron-parser` 接入 + 时区支持 + `computeNextRun()`；`isScheduleDue` 改为按计划时刻判定
3. 调度 API 校验与 `nextRunAt` 返回
4. 调度 Tab（表达式 / 下次运行 / 开关 / 批量编辑）
5. `GET /health` + 页面失败横幅

**验收**：
- 间隔与 cron 各配一个 job，`nextRunAt` 与实际触发误差 ≤ tick（30s）
- 手动运行不改变下一次计划时刻
- v1 `schedules.json` 自动迁到 v2；回滚只恢复备份文件即可
- 非法 cron 在 PUT 时被 400 拒绝，UI 有提示

### P2 — 重叠 / 补跑 / 依赖（预计 2–3 天）
1. `overlapPolicy=skip|queue`（`replace` 仅白名单 job 允许）
2. `catchUpPolicy`（`none|once|window`）+ 停服后启动时的补跑决策与去重
3. 流水线 job：`steps` 串行 + `parentRunId` + 失败策略
4. 保留策略：runs 500 条 / 90 天、每 job 50 条、日志 7 天轮转
5. 「全部停止」+ 运行历史过滤

**验收**：
- 同 job 长任务未结束时，下一次按 skip 策略不重复启动
- 停服 2 小时后重启：`once` 补一次、`none` 不补、`window` 按上限补
- 流水线中途失败：`continue` 跑完剩余步骤，`abortPipeline` 停止并标记
- 运行 100 次后 `runs.json` 与日志目录不无限增长

### P3 — 可选增强
- Webhook 通知（失败 / 连续失败 2 次）
- 日志 SSE 推送替代 2s 轮询（长任务更省请求）
- 指标导出（每 job 成功率 / 平均耗时 / 下次到期）到 `/api/admin/tasks/metrics`
- 「调度预览」：未来 5 次触发时间

## 8. 验收标准（整体）

| # | 标准 |
|---|---|
| 1 | 现有 21 个 job 的调度配置可在不写代码的情况下创建、修改、停用 |
| 2 | 任意时刻 `GET /schedules` 可回答「下一次何时跑、上次结果如何」 |
| 3 | 停服 / 手动运行 / 超并发三种场景有明确、可观测的语义 |
| 4 | 单任务日志在运行中可实时查看，结束后可从历史回看 |
| 5 | 调度数据与运行记录有上限，长期运行不撑爆 `~/.innate` |
| 6 | 任何调度异常（非法表达式、子进程失败、错过的触发）都能在页面上看到，而不是只看日志文件 |

## 9. 风险与决策记录

| 议题 | 决策 | 理由 |
|---|---|---|
| 调度存储 JSON vs SQLite | 先保留 JSON（v2），超过 ~1000 条运行记录或需要按字段查询时再迁 `feeds.db` | 单进程单写者、量小；迁移成本可延后 |
| 单实例 vs 分布式 | 单实例（本机后端进程） | 当前无多机部署诉求；多实例需选主/租约，收益低 |
| 外部 cron（系统计划任务）vs 内置调度 | 两者不混用；内置调度是唯一入口 | 双入口会产生同一 job 并发与状态分裂 |
| `replace` 重叠策略 | 默认禁用，仅白名单 | 强杀采集子进程可能留下半写入 JSON |
| 秒级精度 | 不支持 | 采集源本身是分钟级；30s tick 足够 |
| 手动运行影响计划 | 不改变下次计划时刻（P1 修正） | 现状用 `lastStartedAt` 判定会推迟定时，属 bug |

## 10. 代码地图

| 位置 | 职责 |
|---|---|
| `backend/src/collectors/jobs.ts` | job 注册表（21 条，单一事实源） |
| `backend/src/app/task-runner.ts` | 子进程启动 / 取消 / 全局并发上限 / 调度 tick |
| `backend/src/app/admin-tasks.ts` | `/api/admin/tasks/*` 路由（含 `run-batch`） |
| `backend/src/data/task-runs-store.ts` | `runs.json` / `schedules.json` / 日志读写与保留 |
| `backend/src/data/task-tags-store.ts` | 任务标签：播种默认映射、读取 `task_tags`/`task_job_tags`、覆盖式更新 |
| `backend/src/db/schema.sql` | `task_tags` / `task_job_tags` 建表与索引 |
| `admin/src/pages/tasks/page.tsx` | 任务列表 / 批量启动 / 运行历史 |
| `admin/src/components/run-log-dialog.tsx` | 日志对话框（运行中 2s 实时刷新） |
| `admin/src/components/schedule-dialog.tsx` | 单 job 调度对话框（P1 将扩展 cron） |
| `$INNATE_HOME/admin/tasks/` | 运行记录、调度配置、日志（默认 `~/.innate`） |
