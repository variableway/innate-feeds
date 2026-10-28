# Trendshift × GitRadar 集成分析（GH #23）

**Status:** done（P0+P1 已落地；P2/P3 待后续）  
**Source:** [variableway/innate-feeds#23 trending shift integration](https://github.com/variableway/innate-feeds/issues/23)  
**参考代码:** `reference/trendshift/`、`reference/gitradar/`（shallow clone，已 gitignore）

Issue #23 要求集成 [quantavil/trendshift](https://github.com/quantavil/trendshift) 与 [quantavil/gitradar](https://github.com/quantavil/gitradar)：先 clone 到 `reference/` 目录分析，再确认集成方式。本文档为分析结论与集成方案。

> **已确认决策（2026-10-28）：** 数据层 = 方案 A+B（CDN 主源 + TS 重写抓取器备源，B 为可替代方式）；UI 层 = 方案 1（概念移植 React）；本轮交付 P0+P1。

---

## 1. 两个项目是什么

| | trendshift | gitradar |
|---|---|---|
| 形态 | Python 数据流水线 + 静态 JSON API | Svelte 5 前端应用（无后端） |
| 产出 | trendshift.io 的 GitHub trending **历史榜单快照** | 消费 trendshift CDN 的**发现/分诊工作台** |
| 许可 | **AGPL-3.0** | **MIT** |
| 代码量 | ~1.6k 行 Python（含 537 行测试） | ~5.1k 行 Svelte/TS（65 个 vitest） |
| 关系 | 数据生产者 | 数据消费者（`quantavil.github.io/trendshift/data/`） |

### 1.1 trendshift（数据流水线）

- **数据模型**：`snapshots(timeframe, period_key, language_filter, repository_full_name)` 复合主键；导出 JSON 每条记录：

  ```json
  {"period_key":"2026-10-28","rank":1,"score":1720,"full_name":"…",
   "github_url":"…","description":"…","language":"Python",
   "stars_total":515,"stars_gained":215,"forks_total":0,"forks_gained":0,
   "created_at":"…","tags":["ai-agent"],"social_mention_platforms":["x"],
   "timeframe":"daily","language_filter":"all"}
  ```

  `period_key` 格式：daily `YYYY-MM-DD`，weekly `YYYY-Www`，monthly `YYYY-Mmm`，yearly `YYYY`。
- **覆盖**：4 个 timeframe（daily/weekly/monthly/yearly）×（all + 15 语言）= 64 个 JSON 文件，每个切片 top-25，共 ~105k 行；weekly/monthly 可回溯到 2024。
- **采集**：带 `RSC: 1` 头请求 trendshift.io，正则解析 React Flight 流中的 `initialData`（无需认证；信号量 10 并发 + 3 次重试）；每日 Actions 同步（20:17 / 23:43 UTC）。
- **发布**：JSON 提交到 `main`，经 GitHub Pages 提供，**CORS 全开放**：
  `https://quantavil.github.io/trendshift/data/{timeframe}/{timeframe}-{lang}.json`（`index.json` 为索引）。

### 1.2 gitradar（发现/分诊前端）

- **数据层**：直接 fetch 上述 CDN JSON，内存归档缓存 + AbortController 超时；新→旧按 `period_key` 分组去重。
- **核心体验**：
  - Timeframe tabs（Today/Week/Month/Year）+ **期次归档滚动**（IntersectionObserver 渐进加载历史期次）；
  - **Triage-as-pagination**：Save / Dismiss 移出发现流，20 级 undo 栈 + undo toast，"All caught up" 进度；
  - Saved / Seen 集合：多词 AND 搜索、按 recent/stars/gained/name 排序；
  - 键盘导航（↑↓/jk、S/D/O、Esc）、触屏滑手势（右存左弃）；
  - 本地存储：IndexedDB（`idb-keyval`）+ BroadcastChannel 跨标签同步、JSON 导入导出、System/Light/Dark 主题。
- **注意**：README 宣传的 social signal 展示（HN/Reddit/X）与 "why it is here" 文案实际**未实现**（数据模型里有字段但未渲染）。

---

## 2. 本仓差距（为什么要集成）

| 能力 | innate-feeds 现状 | trendshift 数据 / gitradar 体验 |
|---|---|---|
| Trending 历史 | 仅当前快照（GitHub Trending 无历史 API） | 可回溯 2024 起的期次排名 |
| 增量指标 | 无 | `stars_gained` / `forks_gained` / `score` / rank |
| 语言分榜 | 仅筛选当前列表 | all + 15 语言独立 top-25 历史 |
| 社交信号 | 无 | `social_mention_platforms`（HN/Reddit/X） |
| 分诊工作流 | hidden（无 undo、无收藏单） | Save/Dismiss/Undo + Saved/Seen |
| 归档浏览 | 按 snapshot date 筛选当前集 | 期次归档无限滚动 |

结论：**数据**取 trendshift（补历史与增量），**体验**取 gitradar（补分诊与归档浏览）。

---

## 3. 集成方案选项

### 3.1 数据层（trendshift）

| 方案 | 描述 | 评价 |
|---|---|---|
| **A. 消费静态 JSON API（推荐）** | 新增 `backend/src/collector/trendshift.ts` 外部 collector（沿用 `ExternalFeedItem`/`FeedCollector` 模式，同 producthunt/yc），从 CDN 拉取 JSON 入 `~/.innate/trendshift/`；前端/静态导出按需镜像 | 零 AGPL 接触；数据免费、带 CORS；受制于第三方更新频率（每日） |
| B. TS 干净室重写 RSC 抓取器 | 用 TypeScript 重写 Flight 解析（~200 行逻辑），直接爬 trendshift.io | 不依赖其 Pages 部署；但自担抓取频率/ToS 风险，工作量与收益不成比 |
| C. 移植/运行其 Python 流水线 | vendor `src/` 或改造成 collector | **不推荐**：AGPL 传染，会使本仓衍生代码被迫开源同许可 |

### 3.2 UI 层（gitradar，MIT）

| 方案 | 描述 | 评价 |
|---|---|---|
| **1. 概念移植到 React（推荐）** | 用 shadcn/Tailwind 重写：Timeframe tabs + 期次归档滚动、`stars_gained` 增量条与 "most gained" 排序、Save/Dismiss/Undo 分诊、键盘导航；Svelte 代码不直接复用，纯逻辑（分组/搜索/triage store）可参考移植 | 契合现有 dual-mode 架构；估 1.5–2 周，可分期 |
| 2. 仅数据展示增强 | 只加 `stars_gained` 列 + 排序 + timeframe 切换，不动 triage | 最小工作量（~2–3 天），先验证数据价值 |
| 3. 独立复刻 gitradar | 新建独立页面/应用 | 不推荐：与本仓 feeds 页重复建设 |

### 3.3 许可红线

- **trendshift 为 AGPL-3.0**：只消费其公开 JSON 数据（事实榜单）不构成衍生作品；一旦复制/改造其代码进本仓，整个组合作品需按 AGPL 开源。→ 方案 A/B 保持清洁，B 属"独立重写"而非复制。
- **gitradar 为 MIT**：代码与概念均可移植，保留其版权声明即可。

---

## 4. 落地状态（P0+P1 已完成）

- **P0 — 数据接入 ✅**：`backend/src/collector/trendshift.ts`（CDN 主源 `fetchCdnSlice` + 备源 `scrapeSlice`（RSC flight 干净室解析 `parseInitialData`）+ `syncTrendshift` 编排，scrape 结果按 `(periodKey, fullName)` 合并保留历史）；CLI `sync trendshift`（`--timeframe/--language/--source/--no-save`）；API `GET /api/trendshift`、`GET /api/trendshift/:timeframe`（本地优先、CDN 兜底）；静态导出 `backend/src/data/export-trendshift.ts` → `frontend/public/data/trendshift/`。本地存储 `~/.innate/trendshift/{tf}/{tf}-{lang}.json` + `manifest.json`。单测 16 项（period_key 推导、双源归一化、RSC 解析、合并语义）。
- **P1 — Trending Shift 视图 ✅**：路由 `/trending-shift`（nav「Trending Shift」）；timeframe tabs、语言切片（all+15）、客户端搜索、4 种排序（rank / most gained / stars / newest）；期次归档分组 + 渐进加载（IntersectionObserver + Load earlier periods）；`stars_gained` 增量条 + 社交提及徽章。数据链路：API 模式 `/api/trendshift/*`，静态模式 `data/trendshift/*`，均兜底公共 CDN（保持 Pages 部署间新鲜度）。组件：`trendshift-toolbar.tsx`、`trendshift-list.tsx`、`hooks/use-trendshift.ts`、`services/trendshift.ts`、`types/trendshift.ts`。
- **P2 — 分诊体验（后续）**：Save/Dismiss/Undo（扩展 hidden.ts + undo 栈 + Saved 单）、键盘导航。
- **P3（可选，后续）**：滑手势、JSON 备份导出。

已知边界：每日/周等切片按 `(periodKey, fullName)` 全量展示（同仓库跨期次重复出现 = 排名变化叙事）；gitradar 的「去重发现流」语义留给 P2 分诊。默认 CLI 同步仅 `all` 语言切片（4 文件约 5MB），按需 `--language python,rust` 或 `--language '*'` 拉全量（约 50MB）。
