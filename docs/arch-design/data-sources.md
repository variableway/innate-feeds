# Data Sources Review — 数据来源 × 模块 × 结构关系

> Issue: [variableway/innate-feeds#31](https://github.com/variableway/innate-feeds/issues/31) 子任务 3
> 日期：2026-10-31 · 覆盖全仓 12 类数据源与两条消费链路（API / 静态导出）

## 1. 总览

innate-feeds 的数据 = **GitHub 侧**（SQLite 为主）+ **外部 JSON 源**（`~/.innate/<source>/` 目录）。所有数据只在本地/CI 生成，**不提交仓库**（`.gitignore` 排除 `frontend/public/data/{readmes,external}/`、chunks 由 CI 重建）。

```text
                       ┌────────────────────────────── GitHub 侧（写 SQLite）─────────────────────────────┐
 gh CLI / Firecrawl ──►│ collector/sync.ts        trending_repos / starred_repos（composite PK, WAL）      │
 gh api (issues)   ──►│ collector/issues-digest  digest JSON dump（~/.innate/digest/，非 SQLite）          │
 gh api (search)   ──►│ collector/github-topics  topics JSON（~/.innate/github-topics/topics/）            │
                       └──────────────────────────────────────────────────────────────────────────────────┘
                       ┌────────────────────────── 外部 JSON 源（~/.innate/<source>/）─────────────────────┐
 Algolia API       ──►│ hackernews/   devto/   lobsters/        社区热帖（GH #31 新增）                    │
 HF Hub API        ──►│ huggingface/                                  模型趋势（GH #31 新增）                  │
 gh api (search)   ──►│ github-new/                                   快速增长新仓库（GH #31 新增）           │
 Firecrawl/HTML    ──►│ producthunt/                                  新品榜                                 │
 YC API            ──►│ yc/                                           公司库                                 │
 静态列表+gh       ──►│ a16z/                                         投资组合                               │
 CDN JSON/抓取     ──►│ trendshift/                                   趋势排名归档                           │
 market index+GQL  ──►│ awesome-dsh/                                  DSH 插件目录                           │
                       └──────────────────────────────────────────────────────────────────────────────────┘
```

每类 JSON 源目录结构一致（`collector/shared/storage.ts`）：

```text
~/.innate/<source>/
├── manifest.json     # 快照索引：[{filename, label, count, fetchedAt}]
└── <label>.json      # {source, label, fetchedAt, count, items: ExternalFeedItem[]}
```

## 2. 数据源清单（模块 ↔ 存储 ↔ API ↔ 前端）

| # | 数据源 | 采集模块（backend/src/） | 存储 | API（`/api/*`） | 前端页面 | 频率 |
|---|--------|--------------------------|------|------------------|----------|------|
| 1 | GitHub Trending（daily/weekly/monthly） | `collector/sync.ts` + `firecrawl.ts`/`github.ts` | SQLite `trending_repos` | `/api/feeds?type=trending` | `/trending` | 每日 |
| 2 | GitHub Starred（含 starred_at） | `collector/sync.ts` + `github.ts` | SQLite `starred_repos` | `/api/feeds?type=starred` | `/starred` | 增量 |
| 3 | Digest issues（ruanyf/weekly、GitHubDaily、**HelloGitHub**） | `collector/issues-digest.ts` | `~/.innate/digest/*.json` | `/api/feeds?type=digest`、`/api/feeds/digest/:id` | `/digest` | 每日/90 天窗 |
| 4 | README 缓存 | `collector/prefetch-readmes.ts`、`collector/github.ts` | `./readmes` + `frontend/public/data/readmes/`（gitignore） | `/api/repos/:owner/:repo/readme` | 仓库详情 | 每周（7 天新鲜跳过） |
| 5 | GitHub Topics（top N/主题） | `collector/github-topics.ts` | `~/.innate/github-topics/topics/` | `/api/topics(+/+(:topic))` | `/topics` | 每日 |
| 6 | Trendshift 排名归档 | `collector/trendshift.ts` | `~/.innate/trendshift/` | `/api/trendshift(/:timeframe)` | `/trending-shift` | 每日 |
| 7 | Awesome DSH 插件目录 | `collector/awesome-dsh.ts` + `dsh/catalog.ts` | `~/.innate/awesome-dsh/` | `/api/plugins*` | `/dsh`（独立域） | 每日 |
| 8 | Product Hunt 榜单 | `collector/producthunt.ts` | `~/.innate/producthunt/` | `/api/external/producthunt` | `/feeds/producthunt` | 手动（每日编排暂移出，GH #33） |
| 9 | YC Companies | `collector/yc-companies.ts` | `~/.innate/yc/` | `/api/external/yc` | `/feeds/yc` | 每周 |
| 10 | a16z Portfolio | `collector/a16z-portfolio.ts` | `~/.innate/a16z/` | `/api/external/a16z` | `/feeds/a16z` | 每月 |
| 11 | **Hacker News**（GH #31 新增） | `collector/hackernews.ts` | `~/.innate/hackernews/` | `/api/external/hackernews` | `/feeds/hackernews` | 每日 |
| 12 | **Hugging Face Trending**（GH #31 新增） | `collector/huggingface.ts` | `~/.innate/huggingface/` | `/api/external/huggingface` | `/feeds/huggingface` | 每日 |
| 13 | **GitHub New**（近 N 天新建高星，GH #31 新增） | `collector/github-new.ts` | `~/.innate/github-new/` | `/api/external/github-new` | `/feeds/github-new` | 每日 |
| 14 | **Dev.to 热文**（GH #31 新增） | `collector/devto.ts` | `~/.innate/devto/` | `/api/external/devto` | `/feeds/devto` | 每日 |
| 15 | **lobste.rs 最热**（GH #31 新增） | `collector/lobsters.ts` | `~/.innate/lobsters/` | `/api/external/lobsters` | `/feeds/lobsters` | 每日 |

注：#8–#15 共用 `ExternalFeedItem` DTO（`collector/shared/types.ts`）与 `FeedCollector` 接口；`/api/external*` 由 `data/external-store.ts` 统一读 manifest 最新快照供数；前端统一走 `/feeds` 菜单（`web-domain.tsx` 的 `Feeds` group）。

## 3. 消费链路（同一数据，两种部署）

```text
                                ┌────────────────── API 模式（默认）──────────────────┐
 collector ──► 存储 ────────────►│ app/server.ts (Hono) ──/api/*──► services/*.ts ──► pages/
                                └─────────────────────────────────────────────────────┘
                                ┌────────────────── 静态模式（VITE_STATIC_MODE=true）──┐
 collector ──► data/export-*.ts ►│ frontend/public/data/*.json ──/data/*──► services/*.ts（同构 DTO）
                                └─────────────────────────────────────────────────────┘
```

静态导出内容（`bun run data:export` → `data/export-incremental.ts` 编排）：

| 导出物 | 模块 | 前端静态读取 |
|---|---|---|
| `manifest.json` + `chunks/{trending,starred}/日期.json` | `export-incremental.ts` | `services/feeds.ts` |
| `digest.json` | `digest-store.ts` | `services/feeds.ts`（叠加 live GitHub） |
| `topics/index.json` + `topics/{topic}.json` | `export-topics.ts` | `services/topics.ts` |
| `trendshift/*.json` | `export-trendshift.ts` | `services/trendshift.ts` |
| `plugins.json` | `dsh/export.ts` | `dsh/services/plugins.ts` |
| `external/index.json` + `external/{source}.json`（GH #31） | `export-external.ts` | `services/external.ts` |
| `readmes/{owner}/{repo}.md` | `export-digest.ts`（copy） | README 回退 |

## 4. 更新编排（谁在什么时候拉数据）

| 路径 | 命令 | 覆盖源 |
|---|---|---|
| 本地一键（GH #31，Orca 定时任务调用） | `bun run data:update:local` | trending daily + starred recent + digest(90d) + topics + 外部 JSON 源（Product Hunt 暂除外，GH #33） |
| 本地全量窗口 | `bun run data:update:window` | 90 天窗（trending+starred+digest+README）+ 导出 |
| 外部源统一 | `bun run sync:vc`（backend `sync:external`） | #8–#15 八源全量，单源失败不中断；root `data:sync:external`（每日编排）暂排除 #8 Product Hunt（GH #33） |
| 单源 | `bun run data:sync:topics` / `data:sync:hackernews` / … | 见 `package.json` scripts |
| Pages CI | `.github/workflows/deploy.yml`（cron 每日） | window + topics + 外部源（GH #31 新增步骤），产物只上传不提交 |

Orca 定时任务（`innate-feeds-data-update`）：每日 07:00 本机跑 `data:update:local`，数据落 `~/.innate`，不触碰 git。

## 5. 各源要点与已知限制

- **GitHub Trending**：无历史 API，只有"当前"快照；Firecrawl 优先、`gh api` 抓 HTML 兜底。
- **Starred**：`application/vnd.github.v3.star+json` 拿 `starred_at`，支持 `--days` 增量。
- **Digest**：每 issue 一条目，标题 `[分类]`/`【分类】` 提取 category，正文提取主链接与 GitHub 仓库；HelloGitHub（`521xueweihan/HelloGitHub`）为 `[开源推荐]` 系列 issue，走通用解析器，无专属解析。
- **GitHub Topics**：top N（默认 50）+ 跳过已在 feeds / 已见过的仓库（flagged `isNew`/`existing`）；用户自加 topic 存 `user-topics.json`。
- **Hacker News**：Algolia `front_page`（实时首页）+ 按日 top（points>20）。
- **Hugging Face**：`/api/trending`（recentlyTrending），空/失败回退 `/api/models?sort=trendingScore`；**huggingface.co 在部分网络（如中国大陆）不可达**，本机同步会超时跳过，CI 正常。
- **GitHub New**：Search `created:>N天前 stars:>10` 按 stars 排序；与 Trending 互补（捕捉刚起飞的新仓库）。
- **Dev.to / lobste.rs**：公开 JSON API，无认证。
- **Product Hunt**：Firecrawl JSON 抽取优先，HTML 兜底；**PH leaderboard 页面已纯 JS 渲染，未配 Firecrawl API key 时 HTML 兜底会稳定拿到 0 条**（不报错）——本机即此状态，需配置 Firecrawl 或改用其官方 API 后才有数据。

## 6. 扩展新数据源的固定套路

1. `collector/shared/types.ts`：`FeedSource` 加标识（可选：`FeedItemMetrics` 加指标字段）。
2. 新建 `collector/<source>.ts`：实现 `FeedCollector`（`fetchLatest`/可选 `fetchByDate`）+ `save()`（`saveItems`）+ 直跑块。
3. `data/external-store.ts`：`EXTERNAL_SOURCES` 加一行（title/description/homepage）。
4. `app/cli.ts` 加 `sync <source>` 分支；`backend/package.json` + 根 `package.json` 加 scripts；`vc-portfolio.ts` 编排加一步。
5. 前端 `types/external.ts` 的 `EXTERNAL_SOURCE_META` 加一项（icon、metrics 展示配置）→ `/feeds` 菜单与 `/feeds/$source` 页面自动出现。
6. 静态模式无需额外代码：`export-external.ts` 自动带出。
7. 测试：normalizer 纯函数测试加进 `collector/external-collectors.test.ts`。
