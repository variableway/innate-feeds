# hot-engine：M1 热度引擎（GH #63）

> 状态：**done**（2026-11-08 交付） · Assignee: claude · 立项 2026-11-08
> 总案：[topic-platform-redesign](../../research/projects/topic-platform-redesign.md) §6.1（含数据核验）
> 方向：跨源信号融合热度榜——**独立源计一次 × 24h 半衰**，48h 窗口，零 LLM。

## 1. 信号源与字段（2026-11-07 实测核验）

| 源 | 位置 | seenAt | 权重 | rank | 说明 |
|---|---|---|---|---|---|
| digest | `~/.innate/digest/digest-{windowStart}.json`（单文件全量 3030 条，2294 条带 `githubRepoFullName`） | `issueCreatedAt`（精确） | **4** | 无 | 按 `source` 细分徽章（github-daily / ruanyf-weekly / hellogithub） |
| trending | SQLite `trending_repos`（`full_name`/`stars`/`snapshot_date`，无 rank 列） | `snapshot_date` T00:00Z（日粒度） | 3 | 无（徽章只亮灯） | 近 5 天 10–16 条/日 |
| trendshift | `~/.innate/trendshift/daily/daily-*.json`（`fullName`/`rank`/`starsGained`/`periodKey`，daily-all 2170 条） | `periodKey`（日粒度） | 3 | `min(rank)` 跨语言切片 | **本地仅存最新一天**，见 §5 归档 |
| github-new | `~/.innate/github-new/new-{date}.json`（`metadata.fullName`/`publishedAt`） | `publishedAt`（精确） | 2 | 无 | 50 条/日 |

topics / starred v1 不纳入（弱信号 / 单人偏差）。窗口 = `[now−48h, now]`，日粒度源按「今天或昨天」计入。

## 2. 热度公式（`rule_version = hot-v1-48h-halflife24h`）

```
heat(repo) = Σ over 独立源 s ∈ 命中源:  w_s × 2^(−hours(first_seen(repo), now)/24)
```

- first_seen 取该仓库全部信号中最早时间戳；**同源多切片只计一次**（trendshift daily-all + daily-typescript 同时命中 = 一次，rank 取 min）。
- 排序：heat 降序 → stars 降序 → fullName 字典序（确定性）。
- velocity **只展示不进公式**：`starsGained` = trendshift 跨切片 max。
- `isNew`：仓库 `created_at` ≤ 30 天（github-new metadata 或 trending 行）。
- 展示元数据：description / language / owner 取 trending 行（最新快照），否则 trendshift，否则 github-new；头像 fallback `https://github.com/{owner}.png`（零 API）。

## 3. Schema（v1 单表；`repo_entities` 推迟 M2）

```sql
CREATE TABLE IF NOT EXISTS hot_snapshots (
  id TEXT PRIMARY KEY,            -- '{snapshot_date}#{rank}'
  snapshot_date TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  full_name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  heat REAL NOT NULL,
  signals_json TEXT NOT NULL,     -- [{source,label?,rank?,seenAt,weight}]
  stars INTEGER, stars_gained INTEGER,
  description TEXT, language TEXT,
  owner_login TEXT, owner_avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hot_date ON hot_snapshots(snapshot_date, rank);
```

保留 30 天（每次构建顺手清理更旧快照）。hidden 过滤：**构建时滤 + API 读取时再滤**。

## 4. 模块接口（`backend/src/curation/heat.ts`）

```ts
export interface HotSignal { source: "trending" | "trendshift" | "digest" | "github-new";
  label?: string; rank?: number; seenAt: string; weight: number; }
export interface HotItem { fullName: string; heat: number; rank: number; stars: number | null;
  starsGained: number | null; description: string | null; language: string | null;
  ownerLogin: string; ownerAvatarUrl: string; signals: HotSignal[]; isNew: boolean; }
export interface HotSnapshot { snapshotDate: string; ruleVersion: string; generatedAt: string; items: HotItem[]; }

export async function buildHotSnapshot(db, opts?: { windowHours?: number; topN?: number; now?: Date }): Promise<HotSnapshot>
```

每源抽取函数独立导出（`extractTrendingSignals` / `extractTrendshiftSignals` / `extractDigestSignals` / `extractGithubNewSignals`），fixture 单测直接喂目录/行。

## 5. 边界

1. **trendshift 归档**：运行时若 `daily/{periodKey}-all.json` 不存在，先把 `daily-all.json` 复制为按日归档（否则明天覆盖后 48h 窗口缺昨天）。
2. **空刊**：某日全源失败 → 照写 0 条快照 + warning（观察期不复制旧刊）。
3. digest 取**文件名排序最新**的 dump；github-new 取最新 `new-{date}.json` + 前一日。
4. `now` 可注入（测试确定性）。

## 6. 出口

| 出口 | 实现 |
|---|---|
| CLI | `bun src/app/cli.ts sync hot`：构建 → upsert → 清理 >30 天 → 导出 |
| API | `GET /api/hot?date=&limit=`（默认最新 top 50，读时再滤 hidden） |
| 静态 | `backend/src/data/export-hot.ts` → `frontend/public/data/hot/{manifest.json, hot-{date}.json}` |
| 挂载 | 根 `package.json`：`data:sync:hot`；追加到 `data:update:local` 尾部 |

## 7. 任务与验收

| # | 内容 | 量级 |
|---|---|---|
| T1-1 | schema migration + `db/index.ts` upsert/query/cleanup helpers | 0.5 天 |
| T1-2 | `curation/heat.ts` 四源抽取 + 公式 + 归并排序 + fixture 单测 | 0.5 天 |
| T1-3 | cli `sync hot` + trendshift 归档 + hidden 过滤 | 0.25 天 |
| T1-4 | `/api/hot` + `export-hot.ts` + `data:sync:hot` 挂载 + AGENTS.md/索引补行 | 0.25 天 |

验收清单：

- [x] fixture 单测：窗口边界 / 独立源去重 / 半衰数学 / tie-break 确定性（7 用例全绿，含 idempotent 落库与 30 天清理）
- [x] 真实数据冒烟：50 条，digest 信号主导（trending 11-06 快照经 52h 衰减权重自然下沉），starred fallback 补齐 22/50 元数据；top 详见提交记录
- [x] `bun test`（110 过 0 失败）+ typecheck 绿；静态导出 `frontend/public/data/hot/{manifest,hot-2026-11-08}.json`；`/api/hot` 与 `/api/hot/dates` 实测 200
