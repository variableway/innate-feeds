# External Collectors (VC Portfolio, Product Hunt, GitHub Topics)

除 GitHub Trending/Starred 外，innate-feeds 支持以下外部数据源。

## 数据源概览

| 数据源 | 采集方式 | 存储 | 更新频率 | CLI 命令 |
|--------|---------|------|---------|---------|
| **Product Hunt** | Firecrawl 抓取 Leaderboard 页面 | `~/.innate/producthunt/` | 每日/周/月 | `bun run sync:producthunt` |
| **YC Companies** | 公开 JSON API（无需认证） | `~/.innate/yc/` | 每周（新 batch） | `bun run sync:yc` |
| **a16z Portfolio** | 静态列表 + GitHub API 补充 | `~/.innate/a16z/` | 月度手动更新 | `bun run sync:a16z` |
| **GitHub Topics** | GitHub Search API（按 topic 搜索，取 top N） | `~/.innate/github-topics/` | 每日 | `bun run sync:topics` |
| **Trendshift** | 静态 JSON API（主）/ trendshift.io RSC 抓取（备） | `~/.innate/trendshift/` | 每日 | `bun run sync:trendshift` |
| **统一同步** | 编排以上所有源 | 各自目录 | — | `bun run sync:vc` |

## Product Hunt

Product Hunt 支持三个周期（类似 GitHub Trending 的 daily/weekly/monthly）：

| 周期 | URL 模式 | 说明 |
|------|---------|------|
| **daily** | `/leaderboard/daily/{yyyy}/{mm}/{dd}` | 每日 Top 25 新品 |
| **weekly** | `/leaderboard/weekly/{yyyy}/{ww}` | 每周 Top（ISO8601 周号） |
| **monthly** | `/leaderboard/monthly/{yyyy}/{mm}` | 每月 Top |

### 命令

```bash
cd backend

# 同步今天的 PH 榜单（默认 all = daily + weekly + monthly）
bun run sync:producthunt

# 只同步 daily
bun src/app/cli.ts sync producthunt --period daily --date 2026-08-25

# 只同步 weekly（自动计算 ISO 周号）
bun src/app/cli.ts sync producthunt --period weekly --date 2026-08-25

# 只同步 monthly
bun src/app/cli.ts sync producthunt --period monthly --date 2026-08-01

# 同步所有三个周期
bun src/app/cli.ts sync producthunt --period all --save
```

### 存储结构

```
~/.innate/producthunt/
├── manifest.json          # 索引
├── 2026-08-25.json        # daily
├── 2026-W35.json          # weekly（ISO 周号）
└── 2026-08.json           # monthly
```

## GitHub Topics

通过 GitHub Search API 按 topic 搜索仓库，用于追踪特定领域的开源项目（AI、LLM、Agent、EdTech 等）。

**API：** `GET https://api.github.com/search/repositories?q=topic:{topic}&sort={sort}`

### 支持的排序

| sort | 说明 |
|------|------|
| `stars`（默认） | 按 Stars 数量降序 |
| `updated` | 按最近更新时间降序 |
| `best-match` | GitHub 相关性排序 |

### 命令

```bash
cd backend

# 同步默认 topics + 已保存的用户 topics（每个取 top 50）
bun run sync:topics

# 只同步指定 topic
bun src/app/cli.ts sync github-topics --topic llm
bun src/app/cli.ts sync github-topics --topic agent --topic rag

# 指定每个 topic 取多少个仓库（默认 50）
bun src/app/cli.ts sync github-topics --topic edtech --limit 50

# 按更新时间排序
bun src/app/cli.ts sync github-topics --topic llm --sort updated

# 列出所有已知 AI topics
bun run topics:list
```

### 预设 AI Topics

| 分类 | Topics |
|------|--------|
| **AI 核心** | artificial-intelligence, machine-learning, deep-learning, generative-ai, neural-network |
| **LLM & Agents** | llm, large-language-model, ai-agent, ai-agents, rag, fine-tuning, prompt-engineering, langchain, autogen |
| **模型 & 训练** | transformer, diffusion-model, gpt, llama, stable-diffusion, mlops, model-training |
| **应用** | ai-coding, ai-assistant, chatbot, ai-search, text-to-image, text-to-speech, voice-assistant, ai-video |
| **基础设施** | vector-database, embedding, gpu, inference, model-serving, edge-ai |
| **多模态** | computer-vision, natural-language-processing, nlp, speech-recognition, image-recognition, object-detection, multimodal |
| **EdTech** | edtech |

Browse all: https://github.com/topics

### 存储结构

```
~/.innate/github-topics/
├── manifest.json                # 旧版扁平 manifest（保留）
├── topics-2026-08-26.json       # 当日合并快照（admin JSON 工作区用）
└── topics/                      # topic 数据源快照（GH #24）
    ├── index.json               # topic 索引（topic / count / newCount / fetchedAt）
    ├── user-topics.json         # 用户通过 /topics 页面保存的 topics（GH #26）
    ├── edtech.json              # 单 topic 快照（含全部 top N 条目）
    └── llm.json
```

### Topic 数据源语义（GH #24）

每个 topic 保留该 topic 的 **top 50**（`--limit` 可调）仓库快照。采集时对两类仓库做「跳过」处理：

| 情况 | 判定 | 采集时 | 展示时 |
|------|------|--------|--------|
| 已在 trending/starred feeds 中 | `existing`（读 SQLite 实时判定） | 不计入新发现 | 保留在列表中，标 `In feeds` |
| 该 topic 之前已采集过 | `firstSeenAt` 早于本次同步 | 不计入新发现 | 保留在列表中 |

即：**发现（new）= 本次首次出现 且 不在 feeds 中**；被跳过的仓库仍然写入快照，因此打开某个 topic 时能看到该 topic 的完整 top 50 列表（`/topics/{topic}`）。

快照写入 `firstSeenAt`，重复同步不会把老仓库重新算作新发现。

### API 与静态模式

| 接口 | 说明 |
|------|------|
| `GET /api/topics` | 已同步 topic 索引（`count` / `newCount` / `existingCount` / `fetchedAt`） |
| `POST /api/topics` | 保存用户新增 topic（body `{ topic }`；API 模式，GH #26） |
| `GET /api/topics/{topic}` | 单 topic 完整列表（含被跳过的条目，带 `isNew` / `existing` 标记） |

`bun run data:export` 把 topic 快照导出到 `frontend/public/data/topics/`（`index.json` + `{topic}.json`，`existing` 在导出时按 SQLite 解析），前端 `/topics` 页在静态模式下读该目录。用户新增的 topic 会立即出现在 index 中，未同步时显示 `Pending sync`；后续默认 `sync:topics` 自动采集，仍沿用 top N 与 `firstSeenAt` 语义。

## YC Companies

从 YC 公开 API 拉取 AI 相关公司数据。

```bash
cd backend

# 同步所有默认批次（W24-S26），搜索 "ai"
bun run sync:yc

# 只同步某个批次
bun src/app/cli.ts sync yc --batch P26

# 自定义搜索词
bun src/app/cli.ts sync yc --query "open source"
```

**默认批次：** W24, S24, F25, W25, X25, P26

### 存储结构

```
~/.innate/yc/
├── manifest.json
├── batch-P26.json
├── batch-W25.json
└── ...
```

## a16z Portfolio

a16z AI 投资组合，静态列表 + GitHub API 补充 Stars 信息。

```bash
cd backend
bun run sync:a16z
```

### 存储结构

```
~/.innate/a16z/
├── manifest.json
└── portfolio.json
```

## Trendshift（GH #23）

[trendshift.io](https://trendshift.io) 的 GitHub trending **历史榜单**（daily/weekly/monthly/yearly × all+15 语言 top-25，含 `stars_gained`/`forks_gained` 增量、tags、社交提及）。补齐 GitHub Trending 无历史 API 的缺口。分析与方案见 [trendshift-gitradar-integration.md](./trendshift-gitradar-integration.md)。

- **主源（A）**：公共静态 JSON API `https://quantavil.github.io/trendshift/data/`（CORS 开放，含历史归档）。
- **备源（B）**：`trendshift.io` RSC flight 抓取（`RSC: 1` 头 + `initialData` 干净室解析），仅当前期次，保存时按 `(periodKey, fullName)` 合并保留历史。**不复用 AGPL-3.0 上游代码**。

### 命令

```bash
cd backend

# 同步全部 timeframe 的 "all" 语言切片（默认，约 5MB）
bun run sync:trendshift

# 指定语言切片 / 全量（约 50MB）
bun src/app/cli.ts sync trendshift --language python,rust
bun src/app/cli.ts sync trendshift --language '*'

# 指定 timeframe / 采集源
bun src/app/cli.ts sync trendshift --timeframe daily,weekly --source scrape
bun src/app/cli.ts sync trendshift --source auto    # CDN 失败时回退 scrape
```

### 存储结构

```
~/.innate/trendshift/
├── manifest.json              # 索引（files: path/timeframe/language/count/fetchedAt）
├── daily/daily-all.json       # 归一化 camelCase 行数组（TrendshiftRepo[]）
├── weekly/weekly-rust.json
└── …
```

### API 与静态模式

`GET /api/trendshift`（切片索引）、`GET /api/trendshift/:timeframe?language=all&period=…`（本地优先、公共 CDN 兜底）。`bun run data:export` 把本地切片导出到 `frontend/public/data/trendshift/`，前端 `/trending-shift` 页在静态模式下读该目录（缺片时同样兜底 CDN）。

## 统一同步

一次命令同步所有源：

```bash
cd backend

# 同步所有源（yc + a16z）
bun run sync:vc

# 同步所有源（含 Product Hunt + GitHub Topics）
bun src/app/cli.ts sync vc --source producthunt --source github-topics

# 同步指定源
bun src/app/cli.ts sync vc --source yc --source a16z
```

## 全部 CLI 命令速查

```bash
# Product Hunt
bun run sync:producthunt                              # today, all periods
bun src/app/cli.ts sync producthunt --period daily    # today, daily only
bun src/app/cli.ts sync producthunt --period weekly    # this week
bun src/app/cli.ts sync producthunt --period monthly   # this month

# YC
bun run sync:yc                                       # all default batches
bun src/app/cli.ts sync yc --batch P26 --query ai     # specific batch

# a16z
bun run sync:a16z

# GitHub Topics
bun run sync:topics                                   # all topics, top 50 each
bun src/app/cli.ts sync github-topics --topic llm     # single topic
bun src/app/cli.ts sync github-topics --topic edtech --limit 50
bun run topics:list                                   # list all topics

# Trendshift
bun run sync:trendshift                               # all timeframes, "all" language slice
bun src/app/cli.ts sync trendshift --language '*'     # every language slice

# Unified
bun run sync:vc                                       # all sources
```

## 模块架构

```
backend/src/collector/
├── shared/
│   ├── types.ts               # ExternalFeedItem, FeedCollector, FeedSource
│   ├── storage.ts             # JSON 存储（manifest + saveItems）
│   └── http.ts                # HTTP 工具（fetchJson, fetchHtml, retry）
│
├── producthunt.ts             # Product Hunt（daily/weekly/monthly）
├── yc-companies.ts            # YC Companies API
├── a16z-portfolio.ts          # a16z Portfolio
├── github-topics.ts           # GitHub Topics Search（top N + 跳过规则）
├── vc-portfolio.ts            # 统一编排器
│
├── github.ts                  # 现有 - GitHub trending/starred
├── firecrawl.ts               # 现有 - Firecrawl 采集
├── issues-digest.ts           # 现有 - Digest issues
├── sync.ts                    # 现有 - Trending/starred sync
├── sync-window.ts             # 现有 - 90天窗口同步
└── prefetch-readmes.ts        # 现有 - README 预取
```

## 数据模型

所有外部采集器共享统一的 `ExternalFeedItem` 接口：

```typescript
interface ExternalFeedItem {
  id: string;                    // 唯一 ID
  source: FeedSource;            // "producthunt" | "yc" | "a16z" | "github-topics"
  title: string;                 // 产品/公司/仓库名
  tagline: string;               // 一句话描述
  description: string;           // 详细描述
  url: string;                   // 原始链接
  externalUrl: string | null;    // 产品官网
  imageUrl: string | null;       // 图标/logo
  categories: string[];          // 分类标签/topics
  metrics: {
    score?: number;              // PH 分数
    comments?: number;           // PH 评论数
    stars?: number;              // GitHub Stars
    teamSize?: number;           // 团队规模
    batch?: string;              // YC batch
    status?: string;             // 公司状态
  };
  metadata: Record<string, unknown>;  // 源特定扩展
  fetchedAt: string;             // 采集时间
  publishedAt: string | null;    // 发布日期
}
```

## 注意事项

1. **不影响现有功能**：新采集器完全独立，不修改 SQLite schema、不改动 trending/starred 同步逻辑
2. **Product Hunt 抓取**：需要 Firecrawl API key（项目已有集成），遵守 PH robots.txt
3. **YC API 限制**：公开 API，有分页限制（每页 20 条），大量批次时请求较多
4. **a16z 数据维护**：静态列表需要手动更新代码中的公司列表
5. **GitHub Topics**：使用 `gh` CLI（已认证时有更高 rate limit），无 gh 时 fallback 到公开 API
6. **存储空间**：JSON 文件比 SQLite 更大，但更易于调试和导出
7. **Trendshift 许可红线**：上游 quantavil/trendshift 为 **AGPL-3.0**——本仓只消费其公开 JSON 数据 / 自建干净室抓取，不 vendor 其代码；若未来需要复用上游实现，须按 AGPL 开源组合作品
