# NewsNow × TrendRadar × NewsNext 接入可行性

**Status:** backlog —— 调研已完成，**尚未决定是否实施**
**Issue:** [variableway/innate-feeds#36](https://github.com/variableway/innate-feeds/issues/36)
**调研日期:** 2026-11-01
**参考代码:** 按本仓约定登记在 [`registry.yaml`](../../registry.yaml)（`id: newsnow` / `trendradar` / `newsnext` / `newsnext-registry`），read-only 调研，不纳入源码；需读时按 `repo@commit` 临时检出

本文回答：这三个项目是什么、本仓差距在哪、怎么接、有什么坑、分几步落地。

> **一句话结论：** 真正值得接的是 **newsnow 的公开 API**（MIT，11 个中文平台热榜，实测全通）；TrendRadar（GPL-3.0）本身**不爬**国内平台，它只是 newsnow 的下游代理，且**无任何 RSS/HTTP 输出**，直接部署收益低于自建 collector；NewsNext（浏览器扩展 + 闭源 CLI）**无法在服务端程序化调用**，只值得借鉴架构模式。

> **本文中的路径引用**均相对于 `references/` 下的检出副本（如 `references/newsnow/server/sources/`），实际调研时按 `registry.yaml` 记录的 `repo@commit` 检出。

---

## 1. 三个项目是什么

| | newsnow | TrendRadar | NewsNext / registry |
|---|---|---|---|
| 形态 | Nitro 全栈应用（自托管新闻聚合站） | Python 流水线（热点→分析→推送） | MV3 浏览器扩展 + 声明式 Provider 资源仓 |
| 许可 | **MIT** | **GPL-3.0** | **MPL-2.0** / registry 也是 MPL-2.0 |
| 规模 | 46 个源模块 / 66 个源 ID，TS | 34k 行 Python | 扩展 28.5k 行 + SDK 11k 行 |
| 成熟度 | v0.0.43，README 提示 NewsNext 即将发布 | v6.11.0，活跃迭代 | `1.0.0-alpha.1`，自述 "not ready for release"、协议版本已到 41 |
| 数据来源 | **自己直连 46 个平台抓取** | **只调 newsnow 公开 API**（`newsnow.busiyi.world/api/s?id=…`） | 声明式 Provider + 浏览器会话 |

### 1.1 关键链路（TrendRadar 的真相）

TrendRadar README 宣传"全网热点聚合"（`references/TrendRadar/README.md:1021-1037` 列 11 个平台），但代码里**没有任何一个对国内平台的直连请求**：

- `references/TrendRadar/trendradar/crawler/fetcher.py:25` —— `DEFAULT_API_URL = https://newsnow.busiyi.world/api/s`
- `references/TrendRadar/trendradar/crawler/fetcher.py:111` —— URL 拼装 `?id={platform_id}&latest`
- `references/TrendRadar/config/config.yaml:50-51` —— 注释明写"数据来源于 newsnow 开源项目"

即 **TrendRadar 是 newsnow 的下游代理**，不做反爬、不做平台适配、无 fallback（`fetcher.py:139-149` 失败即该平台空）。

### 1.2 newsnow 的 46 个源里，哪些在境外 CI 可用

`references/newsnow/server/sources/` 下 46 个源模块（44 个 `.ts` + 2 个目录），运行时展开为 66 个源 ID。按抓取方式与目标域名归类：

| 类别 | 数量 | 代表源 | 抓取方式 |
|---|---|---|---|
| 🔴 境内 API/HTML | 29 | 微博、抖音、知乎、B站、百度、头条、贴吧、快手、豆瓣、澎湃、凤凰、虎扑、36氪、财联社、华尔街见闻、雪球、格隆汇、金十 | JSON API 或 HTML 解析，**美国 runner 大概率失败** |
| 🟡 中文但相对可行 | 7 | 少数派、掘金、IT之家、solidot、v2ex、freebuf、pcbeta | 纯 RSS / JSON Feed / 境外可达线路 |
| 🟢 境外 | 7 | github、hackernews、producthunt、v2ex、solidot、kaopu、steam | HTML / RSS |
| ⚫ 上游已禁用 | 3 | `ghxi`、`linuxdo`、`smzdm` | `shared/pre-sources.ts:353-386` 标 `disable: true`，不在 `sources.json` 中 → API 返回 "Invalid source id" |
| 🟠 Cloudflare 环境禁用 | 6 | `36kr`、`36kr-quick`、`36kr-renqi`、`bilibili-hot-video`、`bilibili-ranking`、`kuaishou` | `disable: "cf"` —— **上游自认在境外 IP 抓不到** |

> `disable: "cf"` 这组是上游给出的**权威境外可达性证据**：Cloudflare Worker 与 GitHub Actions 同为境外 IP，官方已标注抓不到，可直接判定失败。

### 1.3 NewsNext 的关键约束（决定了它无法被服务端调用）

- **CLI 闭源**：`references/newsnext/README.md:20-22` 明确 "The CLI is currently closed source"；npm 上 `newsnext@1.0.0-alpha.1` 的 license 为 **UNLICENSED**。
- **SDK 开源但默认拉起闭源 CLI**：`references/newsnext/packages/sdk/src/transport.ts:12-13` —— `spawn(command[0], …)`，默认 `command = ["newsnext"]`。
- **逃逸口**：`packages/sdk/src/source/**` 子路径是纯 Node 实现（`source/core/index.ts:1-51` 全为纯函数，`grep "browser\.|window\.|document\.|chrome\."` 在该目录零命中），且已发布 npm（`@newsnext/sdk@1.0.0-alpha.1`，MPL-2.0，tarball 含 LICENSE、57 文件、520KB）。
- **但它只提供 Source 定义引擎，不提供已采集数据** —— 采集发生在浏览器 Worker 里（`docs/SOURCE_ARCHITECTURE.md:29-30`）。

结论：NewsNext 的数据链路 = **浏览器扩展抓源站**。第三方在服务端拿不到它的数据。

---

## 2. 本仓差距

| 能力 | innate-feeds 现状 | 上游能补什么 |
|---|---|---|
| 中文热榜 | ❌ 完全没有（现有 8 个 external 源全是英文/开发者向） | **11 个中文平台热榜**（微博/知乎/抖音/B站/百度/头条/贴吧/财联社/澎湃/凤凰/华尔街见闻） |
| 通用 RSS 摄入 | ❌ 无 | newsnow 的 RSS 源（solidot/v2ex/少数派…） |
| 排名轨迹 / 脱榜语义 | ❌ 无时序热度模型 | TrendRadar 的 `rank_history` + `rank=0` 脱榜 + `rank/frequency/hotness = 0.6/0.3/0.1` 加权 |
| 关键词/正则过滤引擎 | 🟡 只有 `topics` / `search` 简单过滤 | TrendRadar 的三区过滤 DSL |
| LLM 语义筛选 | 🟡 有 AI digest，但不是"自然语言兴趣分类" | TrendRadar 的 `ai/filter*.py` |
| 多渠道推送 | ❌ 无 | 9 渠道 |
| MCP 查询层 | ❌ 无 | TrendRadar 27 tools / NewsNext SDK |
| 时段调度 | ❌ 只有 Actions cron | TrendRadar `timeline.yaml` 5 预设 |

**重复建设（不要接）**：Hacker News（宿主用 Algolia API 更稳）、定时抓取、SQLite 持久化、静态导出→前端（宿主 dual-mode 更成熟）、HTML 报表（宿主是 React 应用）。

---

## 3. 集成方案选项

### 3.1 数据层

| 方案 | 描述 | 评价 |
|---|---|---|
| **A. 自建 collector 调 newsnow 公开 API（推荐）** | 新增 `backend/src/collector/newsnow.ts`，按 platform id fan-out 调 `https://newsnow.busiyi.world/api/s?id={id}&latest`，映射到 `ExternalFeedItem`，落 `~/.innate/newsnow/` | **零 GPL 接触**；约 300 行 TS；复用宿主 `storage.ts` / `external-store.ts` / `export-external.ts` / `services/external.ts` 全链路 |
| B. 移植 newsnow 的 46 个源实现 | 把 `server/sources/*.ts` 搬进宿主 | MIT 可抄，但需重写 `ofetch`→`fetch`、加字段映射层；且 🟡🟢 仅 14 个源值得搬，🔴 29 个在 CI 上白写 |
| C. 部署 TrendRadar 再消费其输出 | Docker 起 TrendRadar，宿主读它的 `output/news/{date}.db` 或调 MCP | **不推荐**：产物是 SQLite 日库 + HTML 报表，**没有可供宿主前端消费的 JSON**；解析 `.db`/HTML 极脆；运维重；GPL 合规虽可行（ mere interaction）但收益极低 |
| D. 消费 newsnext/registry 的声明式 Provider | 实现一套 html/json/rss loader 解释器 | **不推荐**：registry 无 package.json / 无入口，JS provider 依赖宿主注入 `context.fetch` 与 `@newsnext/sdk`；等于重写一遍抓取层 |

### 3.2 备选上游：60s API（本次独立发现）

| 项 | 值 |
|---|---|
| 端点 | `https://60s.viki.moe/v2/{platform}` |
| 托管 | **Cloudflare**（响应头 `server: cloudflare`，`cf-ray: …-AMS`）→ GitHub Actions 美国 runner 可达 |
| 结构 | `data[]` = `{title, hot_value, link}` —— **与宿主 `ExternalFeedItem` 几乎完美对应** |
| 实测可用 | `weibo`(50) `zhihu`(30) `toutiao`(50) `douyin`(50) `60s`(每日新闻 15) |
| 限制 | **有速率限制**，连续请求会 429，需 ≥6s 间隔；`bili`/`baidu`/`tieba`/`36kr` 等路径不存在或 500 |

价值：作为 newsnow 的**备源**，补上单点故障（newsnow 挂了 → 切 60s）。

### 3.3 许可红线

- **newsnow = MIT**：可安全复制源文件，义务是保留版权声明 + MIT 全文（`references/newsnow/LICENSE:1-3`）。若用其公开 API 则连声明都不需要，仅需注明来源。
  - ⚠️ 部分源改写自 **RSSHub**（MIT）：`server/sources/cls/utils.ts:1`、`server/sources/coolapk/utils.ts:1`、`server/sources/wallstreetcn.ts:32` —— 需**双署名**。
- **TrendRadar = GPL-3.0**（`references/TrendRadar/LICENSE`，全仓仅此一个许可文件，无逐文件头）：
  - ❌ **复制其 Python 源码进本仓 = 整个 innate-feeds 必须按 GPL-3.0 分发**（`LICENSE:208-227` §5(c)）。本仓目前**根目录无 LICENSE 文件**，引入会首次带来开源义务 —— 不可接受。
  - ✅ **参考设计自己实现**（思路/算法/接口契约不受版权保护）。
  - ✅ **仅通过 HTTP/MCP 交互**（`LICENSE:100-101` §0 "mere interaction"）→ 本仓无 GPL 义务。但若把它的容器镜像**再分发给第三方**，需附对应源码（§6(d)）。
  - ❌ 即使"只抄文字"也侵权：`config/ai_analysis_prompt.txt`（186 行中文 prompt）、`config/frequency_words.txt`、`trendradar/report/html.py`（3221 行）、`docs/assets/script.js`（239KB）—— 这些是独立受版权保护的作品，**GPL 豁免不了**。
  - ⚠️ "TrendRadar" 是名称/商标，不可用于标识自建实现。
- **newsnext / registry = MPL-2.0**：文件级 copyleft。复制文件进本仓 → 被复制文件保持 MPL-2.0（项目其余部分不受影响）。但宿主**目前无 LICENSE 文件**，建议先建 `THIRD_PARTY_NOTICES.md` 或 `licenses/` 目录。
  - ⚠️ 实测上游**源文件内无逐文件 MPL 声明**（`grep "Mozilla Public License"` 在 `apps/`、`packages/` 零命中），逐文件复制存在归属不清 → **以 npm 依赖方式整体引入 `@newsnext/sdk` 更稳妥**（其 tarball 实测含 LICENSE）。
  - ⚠️ `packages/cmdk` 声明 MIT 但无独立 LICENSE 文件；`packages/date-parser`、`packages/shared` **无 license 字段** → 需向上游确认。

---

## 4. 实测结果（本机，2026-11-01）

### 4.1 newsnow 公开 API —— 11/11 全通

```
GET https://newsnow.busiyi.world/api/s?id={platform}&latest
UA: Mozilla/5.0 (Windows NT 10.0; Win64; x64) … Chrome/91.0.4472.124 Safari/537.36
```

| platform id | HTTP | items | status |
|---|---|---|---|
| `zhihu` | 200 | 20 | success |
| `weibo` | 200 | 30 | success |
| `toutiao` | 200 | 30 | cache |
| `baidu` | 200 | 30 | success |
| `douyin` | 200 | 30 | success |
| `tieba` | 200 | 30 | success |
| `ifeng` | 200 | 12 | success |
| `thepaper` | 200 | 20 | success |
| `cls-hot` | 200 | 13 | cache |
| `wallstreetcn-hot` | 200 | 10 | success |
| `bilibili-hot-search` | 200 | 30 | cache |

响应项字段：`{id, title, url, mobileUrl?, extra{hover?, date?, info?, icon?}}`。
⚠️ TrendRadar 的勘查实测：**不带 UA 会 403**，带 UA 200 —— 存在 header 级 bot 防护。CI 必须固定 UA + 重试 + 缓存。
⚠️ `status` 有 `success`/`cache` 两种；`cache` 表示命中其 30 分钟 TTL，**数据本身有效**。

### 4.2 60s API —— 4/4 可用（备源）

`https://60s.viki.moe/v2/{weibo,zhihu,toutiao,douyin}` → `data[] = {title, hot_value, link}`，Cloudflare 托管。需 ≥6s 间隔防 429。

### 4.3 未验证

- 上述可达性在**本机（中国网络）**测得，**未在 GitHub Actions 美国 runner 上实测**。newsnow 的 403→200 说明是 header 级防护而非地域封锁，故判断 CI 可用，但**需实测确认**。
- newsnow 官方实例 `newsnow.busiyi.world` 的**长期可用性/SLA 无保证**，且是单点。
- 各源返回条数偏少（10–30 条），newsnow 自身 `/api/s` 截断为 30 条（`server/api/s/index.ts:67`）。

---

## 5. 落地计划

### P0 — 数据接入（预估 1–2 天）

**新增** `backend/src/collector/newsnow.ts`：

1. `NewsNowCollector implements FeedCollector`，`source = "newsnow"`。
2. 平台清单常量（11 个 id + 中文显示名 + 分类），逐个 fan-out 请求 `newsnow.busiyi.world/api/s`。
3. **字段映射**（newsnow `NewsItem` → 宿主 `ExternalFeedItem`）：
   - `id` → `newsnow-{platform}-{id}`
   - `title` → `title`
   - `extra.hover` → `tagline` / `description`
   - `extra.info`（字符串，如 `"✰ 1.2k"`）→ **需写解析器**提取数值到 `metrics.score`
   - `extra.icon` → `imageUrl`
   - `extra.date` / `pubDate` → `publishedAt`
   - `platform` → `categories: [platform]`
4. **工程要求（TrendRadar 缺的关键部分，务必补上）**：
   - 固定 UA（否则 403）
   - 平台间 2s 间隔 + 单平台 3 次重试 + 指数退避
   - **单平台失败不影响其他平台**（宿主 `vc-portfolio.ts:36-46` 的 `runStep` 已是这个模式，落到平台级）
   - **全失败时告警**（避免 TrendRadar 那种"静默产出空报告"）
   - **备源降级**：newsnow 挂了 → 切 60s API
5. 存储：`~/.innate/newsnow/` + manifest（复用 `saveItems`）。

**接入点（沿用既有模式，共 8 处）**：

| 文件 | 改动 |
|---|---|
| `backend/src/collector/shared/types.ts` | `FeedSource` 联合类型加 `"newsnow"` |
| `backend/src/collector/newsnow.ts` | 新建 |
| `backend/src/collector/vc-portfolio.ts` | 注册进编排器 `targets` 数组 |
| `backend/src/data/external-store.ts` | `EXTERNAL_SOURCES` 加一条 |
| `backend/src/app/cli.ts` | `sync newsnow` 分支 |
| `backend/package.json` | `sync:newsnow` 脚本 |
| `frontend/src/types/external.ts` | `ExternalSourceId` + `EXTERNAL_SOURCE_META` 条目 |
| `frontend/src/services/external.ts` | `SOURCE_IDS` 数组 |

静态导出（`export-external.ts`）与前端页面**自动生效**，无需额外改动。

### P1 — 前端呈现（预估 0.5–1 天）

- `SourceMetricConfig` 加 `heat`（热度值）指标键，映射到 `metrics.score`。
- 热榜条目天然需要**排名**展示 → `ExternalItemCard` 增加可选 `rank` 展示（`metadata.rank`）。
- 在 `/feeds` 索引卡片上标注"11 平台 · 中文热榜"。
- 搜索：现有 `searchPlugins` 已含 `categories`，平台名可搜。

### P2 — 可选增强（按需）

- **平台分组页**：`/feeds/newsnow` 内加平台切换 tab（替代 11 个独立 source id，避免 11 份前端样板）。
- **排名历史**：借鉴 TrendRadar 的 `(url, platform)` 唯一键 + `rank_history` 表设计，在宿主 `backend/src/db/schema.sql` 加 `hotlist_rank_history`，实现"热度变化"（`stars_gained` 的热榜版）。
- **LLM 摘要**：对热榜做自然语言兴趣筛选 —— ⚠️ **prompt 必须自写**，不得抄 TrendRadar 的 `ai_analysis_prompt.txt`。

### P3 — 明确不做

- ❌ 引入 TrendRadar 源码 / 镜像再分发（GPL）
- ❌ 实现 registry 的 loader 解释器（成本 ≈ 重写抓取层）
- ❌ 依赖 `@newsnext/sdk` 主入口（会 spawn 闭源 CLI）
- ❌ 移植 newsnow 的 🔴 29 个境内源（CI 上抓不到；API 模式下用户自建亦无必要，因为 newsnow API 已代取）

---

## 6. 风险与未决

| 风险 | 等级 | 缓解 |
|---|---|---|
| newsnow 公开实例单点故障 | 🔴 高 | 60s 备源 + 空数据告警；或自建 newsnow（MIT）作为上游 |
| 上游 ToS / 内容版权 | 🔴 高 | 仅聚合标题 + 链接（不转载正文），标注来源 |
| CI runner 可达性未实测 | 🟡 中 | P0 先在 Actions 上跑一次探针 workflow 再合并 |
| newsnow 返回条数仅 10–30 | 🟡 中 | 接受（热榜场景够用）；需更多则自建 newsnow |
| 国内平台内容与宿主「开发者/开源」定位的契合度 | 🟡 中 | 建议做成**独立 source**，不混入 `/trending` 主线 |
| 宿主无 LICENSE 文件 | 🟡 中 | 本次新增第三方依赖前先补 `THIRD_PARTY_NOTICES.md` |

### 待你决策

1. **接入范围**：只接 11 平台热榜（方案 A），还是同时补通用 RSS 摄入（solidot/v2ex/少数派…）？
2. **形态**：一个 `newsnow` source（内含平台切换）还是 11 个独立 source id（前端样板 ×11）？
3. **是否自建 newsnow**：依赖公共实例（零运维、单点）还是自建一个 newsnow 作为上游（多一层运维、无单点）？
4. **是否做排名历史**：P2 的 `rank_history` 表值得做吗（能补上宿主缺失的时序热度维度）？

---

## 7. 附：本次勘查的局限

- 只读勘查，未修改任何上游文件；`references/` 下的四个检出副本已被 `.gitignore:66` 排除，未纳入版本控制，按 `registry.yaml` 记录的 `repo@commit` 可随时复现。
- newsnow/60s API 可达性在**本机（中国网络）**测得，**未在 GitHub Actions 美国 runner 实测**。
- 未安装依赖、未运行任一上游项目的构建/爬虫。
- 未审计上游 2026-11-01 之后的许可变更；正式复用前须以远端 `LICENSE` 现状为准。
- newsnext 本地为单提交压缩快照（2026-10-17），无法用 git 历史评估活跃度。
