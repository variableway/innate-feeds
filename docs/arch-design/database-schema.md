# SQLite 表结构（feeds.db）

> 事实来源：`backend/src/db/schema.sql` + `backend/src/db/index.ts`。本页记录 2026-11-12
> 实际库（`~/.innate/feeds.db`）的表、行数、写入方与用途，供后台工作台与二次开发参考。

## 0. 概览

- 数据库路径：`~/.innate/feeds.db`（`DB_PATH` / `INNATE_HOME` 可覆盖，见 `backend/src/db/paths.ts`）。
- 打开方式：WAL + `PRAGMA foreign_keys = ON`；每次 `getDb()` 执行 `schema.sql`（幂等
  `CREATE ... IF NOT EXISTS`）并重建两个 FTS5 索引（`backend/src/db/index.ts:9-32`）。
- 逻辑表 **8 张**：`trending_repos` / `trending_repo_topics` / `starred_repos` /
  `starred_repo_topics` / `hot_snapshots` / `task_tags` / `task_job_tags` /
  `admin_saved_queries`。
- FTS5：2 张虚拟表（`trending_repos_fts` / `starred_repos_fts`）+ 8 张 SQLite 自动维护的影子表
  （`*_config` / `*_data` / `*_docsize` / `*_idx`），以及内部表 `sqlite_sequence`。
  后台左栏的「表（N）」按 `table.internal` 过滤，影子表不计入业务表。

2026-11-12 17:1x 实际行数（采集进行中，数值会随同步增长）：

| 表 | 行数 | 说明 |
|---|---:|---|
| `trending_repos` | 4,162 | daily 1,701（最新 `2026-11-12`）、weekly 964 / monthly 1,497（最新 `2026-10-26`） |
| `trending_repo_topics` | 15,130 | trending 仓库的 topic 多对多 |
| `starred_repos` | 6,235 | 最新 `starred_at` = `2026-11-12T05:55:03Z` |
| `starred_repo_topics` | 44,243 | starred 仓库的 topic 多对多 |
| `hot_snapshots` | 50 | `2026-11-12` 首份榜单，`rule_version = hot-v1-48h-halflife24h` |
| `task_tags` | 4 | github / dsh / topics / news |
| `task_job_tags` | 21 | 21 个采集任务全部有标签 |
| `admin_saved_queries` | 4 | 工作台预置示例 SQL |
| `trending_snapshots` | — | **已于 2026-11-12 删除**（见 §4） |

## 1. 采集数据表

### 1.1 `trending_repos` — GitHub Trending 快照

一个 GitHub 仓库在一个「日期 + 周期」下是一条记录；同一仓库可跨日期/周期重复出现。

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK | 复合键 `trending-{snapshot_date}-{period}-{github_repo_id}` |
| `github_repo_id` | INTEGER NOT NULL | GitHub 仓库 ID |
| `name` / `full_name` | TEXT NOT NULL | 仓库名 / `owner/repo` |
| `description` | TEXT | 仓库描述 |
| `url` / `homepage` | TEXT | HTML URL / 主页 |
| `stars` / `forks` / `watchers` | INTEGER | 抓取时计数 |
| `language` | TEXT | 主语言（可空） |
| `owner_login` / `owner_avatar_url` / `owner_url` | TEXT | 属主信息 |
| `created_at` / `updated_at` | TEXT NOT NULL | GitHub 仓库时间戳 |
| `period` | TEXT NOT NULL | `daily` / `weekly` / `monthly`（CHECK 约束） |
| `snapshot_date` | TEXT NOT NULL | `YYYY-MM-DD`，榜单日期 |
| `fetched_at` | TEXT | 入库时间，默认 `datetime('now')` |

索引：`idx_trending_repos_language`、`idx_trending_repos_stars`、
`idx_trending_repos_snapshot_date`、`idx_trending_repos_period`。
写入：`backend/src/collectors/core/sync.ts`（`upsertTrendingRepo`）；窗口同步
`sync-window.ts`。读取：`backend/src/db/index.ts` 的 `listFeeds` / `getFeedStats` /
`getFeedDates` 等。

### 1.2 `trending_repo_topics`

| 列 | 类型 | 说明 |
|---|---|---|
| `repo_id` | TEXT NOT NULL | → `trending_repos.id` |
| `topic` | TEXT NOT NULL | GitHub topic（小写） |

PK `(repo_id, topic)`；索引 `idx_trending_repo_topics_topic(topic)`。写入
`insertTrendingTopics()`，读取时批量 JOIN 避免 N+1。

### 1.3 `starred_repos` — 已 Star 仓库

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER PK | GitHub 仓库 ID（与 trending 表不同，这里用仓库 ID 本身） |
| `name` / `full_name` | TEXT | `full_name` UNIQUE |
| `description` / `url` / `homepage` | TEXT | 元数据 |
| `stars` / `forks` / `watchers` | INTEGER | 计数 |
| `language` | TEXT | 主语言 |
| `owner_login` / `owner_avatar_url` / `owner_url` | TEXT | 属主信息 |
| `created_at` / `updated_at` | TEXT NOT NULL | GitHub 时间戳 |
| `starred_at` | TEXT | star 时间（来自 `star+json` accept header），增量同步依据 |
| `fetched_at` | TEXT | 入库时间 |

索引：`idx_starred_repos_language`、`idx_starred_repos_stars`。
写入：`syncStarredRepos()`（`sync.ts`）；读取同 feeds 查询层。

### 1.4 `starred_repo_topics`

结构同 `trending_repo_topics`，`repo_id` 为 INTEGER → `starred_repos.id`。索引
`idx_starred_repo_topics_topic`。

## 2. GitHub Hot 热度榜：`hot_snapshots`

GH #63（M1 热度引擎）的落库表，**在用**。不是「趋势历史表」，而是跨源热度排名：

- 数据来源：digest / trending / trendshift / github-new 四类信号做独立源去重，
  24h 半衰加权，规则版本 `rule_version` 随每行落库（`backend/src/curation/heat.ts`）。
- 结构：`id`（`{snapshot_date}#{rank}` PK）、`snapshot_date`、`rule_version`、
  `full_name`、`rank`、`heat`、`signals_json`（各源信号 JSON）、
  `stars`、`stars_gained`、`description`、`language`、`owner_login`、
  `owner_avatar_url`、`created_at`。
- 写入：`upsertHotSnapshot()`（整体替换某日榜单，单事务）；读取：`getHotSnapshot()` /
  `getHotSnapshotDates()`；`cleanupHotSnapshots(keepDays=30)` 只保留 30 天。
- 出口：`GET /api/hot`、`GET /api/hot/dates`；静态导出
  `backend/src/data/export-hot.ts` → `frontend/public/data/hot/`；前端
  `frontend/src/components/hot-board.tsx`（trending 页三层结构的热点层）。
- 采集任务：`SYNC_JOBS` 的 `hot`（`cli sync hot`），产出一行
  `SQLite hot_snapshots + frontend/public/data/hot`。
- 空表说明：本地此前从未跑过 `sync hot`，所以 2026-11-12 17:05 前是 0 行；当天
  批量运行 `hot` 后已有 50 行（`2026-11-12`）。**不要删这张表**，删了 `/api/hot`
  与热点榜会立即失效。

## 3. 后台任务数据表（issue #70）

### 3.1 `task_tags` — 标签字典

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `slug` | TEXT UNIQUE | `github` / `dsh` / `topics` / `news` |
| `label` | TEXT | 展示名 |
| `sort_order` | INTEGER | 分组顺序（github 10 / dsh 20 / topics 30 / news 40） |
| `created_at` | TEXT | |

首次读取由 `backend/src/data/task-tags-store.ts` 的 `ensureTaskTagSeed()` 播种；之后以库为准，
不会覆盖手工修改。

### 3.2 `task_job_tags` — 任务 ↔ 标签

| 列 | 类型 | 说明 |
|---|---|---|
| `job_id` | TEXT NOT NULL | `backend/src/collectors/jobs.ts` 的 `SYNC_JOBS.id` |
| `tag_id` | INTEGER NOT NULL | → `task_tags.id`，`ON DELETE CASCADE` |

PK `(job_id, tag_id)`；索引 `idx_task_job_tags_tag(tag_id)`。一个任务可多标签，后台按
`sort_order` 最小的标签作为主分组展示。API：`GET /api/admin/tasks/tags`、
`PUT /api/admin/tasks/jobs/:id/tags`。

### 3.3 `admin_saved_queries` — 工作台保存的 SQL

`id` / `name` / `sql` / `description` / `created_at` / `updated_at`。表在
`ensureAdminSavedQueries()`（`backend/src/data/admin-saved-queries.ts`）中创建，空表时播种 4 条
示例（AI Agent topic 白名单、FTS5 BM25、`json_each` 等）。仅后台工作台读写。

## 4. 已删除：`trending_snapshots`

原定义为「历史 trending 快照分析表」（`snapshot_date` / `period` / `repo_id` / `rank` /
`stars_at_time` / `stars_gained`），但：

- 0 行，任何采集器都没有写入；
- 日期/周期/星数事实已由 `trending_repos.snapshot_date` / `period` / `stars` 承载，
  排名也未落库，保留只会误导查询。

2026-11-12 处理：从 `backend/src/db/schema.sql` 移除建表与两个索引，并保留
`DROP TABLE IF EXISTS trending_snapshots;` 让旧库在下次连接时自动收敛；在
`backend/src/db/index.test.ts` 增加「不再存在」断言。旧库已执行 DROP。

## 5. FTS5 全文索引

两张 external-content 虚拟表，内容存在业务表，触发器同步：

| 虚拟表 | 内容表 | 列 |
|---|---|---|
| `trending_repos_fts` | `trending_repos` | `name` / `full_name` / `description` |
| `starred_repos_fts` | `starred_repos` | 同上 |

- 触发器：`*_fts_ai`（INSERT）/ `*_fts_ad`（DELETE）/ `*_fts_au`（UPDATE）维护索引。
- 每次 `getDb()` 执行 `INSERT INTO ..._fts(...) VALUES ('rebuild')`，自愈旧库或绕过触发器的写入。
- 影子表（`_config` / `_data` / `_docsize` / `_idx`）是 SQLite 内部实现，**不要手工改**。
- 查询示例见 `admin_saved_queries` 的「agent 关键词 · FTS5 BM25」示例。

## 6. 关系图（逻辑）

```
trending_repos 1 ── n trending_repo_topics
starred_repos  1 ── n starred_repo_topics
task_tags      1 ── n task_job_tags（job_id 指向代码注册表 SYNC_JOBS，无 FK）
hot_snapshots / admin_saved_queries：独立表（hot 通过 full_name 与仓库概念关联，无 FK）
```

## 7. 维护与排查

- 备份：停写后复制 `feeds.db`（连同 `-wal` / `-shm`），或用 SQLite `.backup`。
- 表清单/行数：后台 `/admin/sqlite` 或 `GET /api/admin/db/tables`；只读查询上限 500 行。
- 影子表/`sqlite_sequence` 属 SQLite 内部表，不参与业务统计。
- 不在库里的数据：hidden 名单在 `~/.innate/hidden.json`（`data/hidden-store.ts`）；
  各外部源原始快照在 `~/.innate/<source>/`；`json_documents` 是后台「扫描 JSON」时
  临时建的表，未扫描时不存在。
- 采集任务运行/调度记录在 `~/.innate/admin/tasks/`（JSON + 日志），不在 SQLite。
