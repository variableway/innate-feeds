# Collector Design: VC Portfolio & Product Hunt Feeds

> 将 YC / a16z / Product Hunt 作为 innate-feeds 的新 category，扩展数据源。

## 1. 数据源分析

### 1.1 Y Combinator

| 项目 | 说明 |
|------|------|
| 数据来源 | 公开 JSON API `https://api.ycombinator.com/v0.1/companies` |
| 认证 | 无需认证 |
| 分页 | 支持，`page` + `totalPages`，每页 20 条 |
| 筛选 | `q=ai`（关键词）、`batch=P26`（批次）、`batch=W24&batch=S24`（多批次） |
| 数据字段 | id, name, slug, website, smallLogoUrl, oneLiner, longDescription, teamSize, url, batch, tags, status, industries, regions, locations, badges |
| YC Launches 页面 | `https://www.ycombinator.com/launches` — 客户端渲染，数据来自同一 API |
| 更新频率 | 每周（新 batch 发布时） |
| 已知 Batch（2024-2026） | W24, S24, F25, W25, X25, P26 |

**API 示例响应：**

```json
{
  "companies": [
    {
      "id": 31442,
      "name": "AICE",
      "slug": "aice",
      "website": "https://aicepower.com",
      "smallLogoUrl": "https://bookface-images.s3.amazonaws.com/...",
      "oneLiner": "Submarine drones for defense",
      "longDescription": "We are building the next generation...",
      "teamSize": 2,
      "url": "https://www.ycombinator.com/companies/aice",
      "batch": "P26",
      "tags": [],
      "status": "Active",
      "industries": ["Industrials", "Defense"],
      "regions": ["United States of America", "America / Canada"],
      "locations": ["San Francisco"],
      "badges": []
    }
  ],
  "nextPage": "https://api.ycombinator.com/v0.1/companies?batch=P26&page=2&q=ai",
  "page": 1,
  "totalPages": 8
}
```

### 1.2 a16z (Andreessen Horowitz)

| 项目 | 说明 |
|------|------|
| 投资列表页 | `https://a16z.com/investment-list/` — 完整 A-Z 列表 |
| AI 专题页 | `https://a16z.com/ai/` — AI Portfolio + 开源项目 |
| 开源项目 | `a16z-infra` GitHub org 下有多个开源项目 |
| 数据获取 | 静态列表 + GitHub API 补充仓库信息 |
| 更新频率 | 月度（投资列表月更） |

**a16z 已知 AI 开源项目：**

| 项目 | GitHub | Stars | 简介 |
|------|--------|-------|------|
| ai-getting-started | a16z-infra/ai-getting-started | 4.1k | JavaScript AI 入门栈 |
| ai-town | a16z-infra/ai-town | 8.3k | AI 虚拟城镇模板 |
| companion-app | a16z-infra/companion-app | 5.8k | AI 伴侣应用 |
| llama2-chatbot | a16z-infra/llama2-chatbot | 1.4k | Llama2 聊天机器人 |
| llm-app-stack | a16z-infra/llm-app-stack | 1.2k | LLM 应用栈工具列表 |

**a16z 已知 AI 投资公司（精选）：**

| 公司 | 类型 | 开源情况 |
|------|------|----------|
| OpenAI | LLM 基础模型 | 部分开源（whisper, gym） |
| Mistral AI | 欧洲开源 LLM | mistralai/* |
| ElevenLabs | AI 语音合成 | 闭源 |
| Ideogram | AI 图像生成 | 闭源 |
| World Labs | 空间智能 | 闭源 |
| xAI | Grok 模型 | xai-org/grok-1 (开源) |
| Character.AI | AI 角色对话 | 闭源 |
| Databricks | 数据+AI 平台 | spark, mlflow, delta |
| Cursor | AI 代码编辑器 | 闭源 |
| Harvey | AI 法律助手 | 闭源 |
| Hebbia | AI 知识工作 | 闭源 |
| Black Forest Labs | FLUX 图像模型 | flux (开源) |
| Civitai | AI 模型社区 | civitai (开源) |
| Exa | AI 搜索引擎 | 闭源 |
| Replicate | 模型推理 | cog (开源) |
| Anyscale | 分布式计算 | ray (开源) |
| Sourcegraph | 代码搜索+Cody | sourcegraph (开源) |
| Promptfoo | LLM 评估 | promptfoo (开源) |
| Hedra | AI 视频生成 | hedra (开源) |
| Pinecone | 向量数据库 | 闭源 |
| Fal.ai | AI 媒体推理 | 闭源 |
| Runway | AI 视频创作 | 闭源 |
| Gamma | AI 演示文稿 | 闭源 |

### 1.3 Product Hunt

| 项目 | 说明 |
|------|------|
| 数据来源 | 抓取 Leaderboard 页面（无公开 API） |
| URL 模式 | `https://www.producthunt.com/leaderboard/daily/{yyyy}/{mm}/{dd}` |
| llms.txt | `https://www.producthunt.com/llms.txt` — 完整 URL 结构说明 |
| 产品详情 | `/products/{slug}` — 名称、tagline、描述、分类、分数、评论 |
| 分类 | `/categories/{slug}` — 如 `ai-coding-agents`, `vibe-coding` |
| 更新频率 | 每日（太平洋时区） |
| 抓取方式 | Firecrawl JSON 提取 或 直接 fetch + HTML 解析 |

**Leaderboard 页面结构（已验证可抓取）：**

```
https://www.producthunt.com/leaderboard/daily/2026/8/25
```

返回的结构化数据包含：
- 产品名称、tagline、描述
- 社区分数（score）、评论数（comments）
- 分类标签（topics: [API, Developer Tools, AI]）
- 产品图标（ph-files.imgix.net）
- 外部链接

**数据示例：**

```
1. akta.pro - Private company data and signals API for the agent economy
   Score: 400, Comments: 77
   Topics: API, Developer Tools, Artificial Intelligence
   URL: https://www.producthunt.com/products/akta-pro
   External: https://akta.pro/
```

### 1.4 YC + a16z 共投的 AI 开源项目

| 项目 | 类型 | GitHub Stars | 开源仓库 |
|------|------|-------------|----------|
| OpenAI | LLM 基础模型 | 80k+ | openai-python, whisper, gym |
| Hugging Face | 模型生态 | 140k+ | transformers, diffusers |
| Replicate | 模型推理 | 8k+ | cog |
| Replit | AI 编程 | - | replit-agent |
| Anyscale | 分布式计算 | 33k+ | ray |
| Databricks | 数据+AI | 30k+ | spark, mlflow, delta |
| Sourcegraph | 代码AI | 10k+ | sourcegraph |

---

## 2. 现有架构分析

### 2.1 现有 Collector 结构

```
backend/src/collector/
├── firecrawl.ts           # GitHub Trending via Firecrawl JSON 提取
├── github.ts              # GitHub Trending/Starred via gh CLI
├── issues-digest.ts       # GitHub Issues digest（独立 JSON 存储）
├── sync.ts                # Trending/Starred 同步编排
├── sync-window.ts         # 90天窗口同步
└── prefetch-readmes.ts    # README 预取
```

### 2.2 现有数据存储

| 存储 | 用途 | 格式 |
|------|------|------|
| SQLite (`feeds.db`) | trending_repos, starred_repos | 关系型，schema.sql |
| JSON dumps (`~/.innate/digest/`) | Issues digest | 文件系统，manifest 索引 |
| Static export (`frontend/public/data/`) | GitHub Pages | JSON chunks |

### 2.3 现有 Digest 模式（可复用）

`issues-digest.ts` 实现了一个独立的 JSON 存储模式：

1. **采集**：通过 GitHub API 拉取 Issues
2. **规范化**：统一数据结构（DigestItem）
3. **存储**：写入 JSON 文件到 `~/.innate/digest/`
4. **索引**：维护 manifest.json
5. **API**：通过 `digest-store.ts` 提供 HTTP 端点
6. **导出**：支持增量导出到 `frontend/public/data/`

这个模式非常适合新的数据源——无需修改 SQLite schema，独立运行。

---

## 3. 架构设计

### 3.1 模块化目录结构

```
backend/src/collector/
├── shared/
│   ├── types.ts               # 通用 feed item 接口
│   ├── storage.ts             # JSON 存储抽象（读写 manifest）
│   └── http.ts                # HTTP 请求工具（fetch + retry + UA）
│
├── producthunt.ts             # Product Hunt 采集器
├── yc-companies.ts            # YC Companies API 采集器
├── a16z-portfolio.ts          # a16z Portfolio 采集器
├── vc-portfolio.ts            # 统一 VC Portfolio 同步编排
│
├── github.ts                  # 现有
├── firecrawl.ts               # 现有
├── issues-digest.ts           # 现有
├── sync.ts                    # 现有
├── sync-window.ts             # 现有
└── prefetch-readmes.ts        # 现有
```

### 3.2 统一数据模型

```typescript
// shared/types.ts

/** 数据源标识 */
export type FeedSource = "producthunt" | "yc" | "a16z";

/** 统一外部 Feed Item 接口 */
export interface ExternalFeedItem {
  /** 唯一 ID，格式: `{source}-{slug|id}` */
  id: string;
  /** 数据源 */
  source: FeedSource;
  /** 产品/公司名称 */
  title: string;
  /** 一句话描述 */
  tagline: string;
  /** 详细描述 */
  description: string;
  /** 原始链接（PH 产品页 / YC 公司页） */
  url: string;
  /** 产品官网 */
  externalUrl: string | null;
  /** 图标/logo URL */
  imageUrl: string | null;
  /** 分类标签 */
  categories: string[];
  /** 量化指标 */
  metrics: FeedItemMetrics;
  /** 源特定扩展数据 */
  metadata: Record<string, unknown>;
  /** 数据采集时间 */
  fetchedAt: string;
  /** 发布/上线日期 */
  publishedAt: string | null;
}

/** 量化指标 — 各源按需填充 */
export interface FeedItemMetrics {
  /** Product Hunt 社区分数 */
  score?: number;
  /** Product Hunt 评论数 */
  comments?: number;
  /** GitHub Stars */
  stars?: number;
  /** 团队规模 */
  teamSize?: number;
  /** YC Batch (e.g. "P26") */
  batch?: string;
  /** 公司状态 */
  status?: string;
}

/** 采集器接口 */
export interface FeedCollector {
  source: FeedSource;
  fetchLatest(): Promise<ExternalFeedItem[]>;
  fetchByDate?(date: string): Promise<ExternalFeedItem[]>;
}

/** 存储结果 */
export interface SaveResult {
  source: FeedSource;
  outDir: string;
  files: string[];
  count: number;
  bytes: number;
}
```

### 3.3 JSON 存储抽象

```typescript
// shared/storage.ts

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ExternalFeedItem, FeedSource, SaveResult } from "./types.js";

export interface ManifestEntry {
  filename: string;
  count: number;
  fetchedAt: string;
  label: string;  // date or batch name
}

export interface Manifest {
  source: FeedSource;
  updatedAt: string;
  entries: ManifestEntry[];
}

/** 获取数据源的存储目录 */
export function getSourceDir(source: FeedSource): string {
  const home = process.env.INNATE_HOME || join(homedir(), ".innate");
  return join(home, source);
}

/** 读取 manifest */
export function readManifest(source: FeedSource): Manifest | null {
  const dir = getSourceDir(source);
  const path = join(dir, "manifest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** 写入 manifest */
export function writeManifest(source: FeedSource, manifest: Manifest): void {
  const dir = getSourceDir(source);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

/** 保存 items 到 JSON 文件并更新 manifest */
export function saveItems(
  source: FeedSource,
  items: ExternalFeedItem[],
  label: string,
  filename?: string,
): SaveResult {
  const dir = getSourceDir(source);
  mkdirSync(dir, { recursive: true });

  const fname = filename || `${label}.json`;
  const payload = {
    source,
    label,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
  const json = JSON.stringify(payload, null, 2);
  const filePath = join(dir, fname);
  writeFileSync(filePath, json, "utf-8");

  // 更新 manifest
  const manifest = readManifest(source) || {
    source,
    updatedAt: new Date().toISOString(),
    entries: [],
  };

  // 替换或追加 entry
  const existingIdx = manifest.entries.findIndex((e) => e.filename === fname);
  const entry: ManifestEntry = {
    filename: fname,
    count: items.length,
    fetchedAt: payload.fetchedAt,
    label,
  };
  if (existingIdx >= 0) {
    manifest.entries[existingIdx] = entry;
  } else {
    manifest.entries.push(entry);
  }
  manifest.updatedAt = payload.fetchedAt;
  writeManifest(source, manifest);

  return {
    source,
    outDir: dir,
    files: [filePath, join(dir, "manifest.json")],
    count: items.length,
    bytes: Buffer.byteLength(json, "utf-8"),
  };
}
```

### 3.4 HTTP 请求工具

```typescript
// shared/http.ts

const USER_AGENT = "innate-feeds/0.1 (+https://github.com/variableway/innate-feeds)";

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { headers = {}, timeout = 30000, retries = 3 } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      console.warn(`[http] Retry ${attempt}/${retries} for ${url} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("unreachable");
}

export async function fetchHtml(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const { headers = {}, timeout = 30000 } = options;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      ...headers,
    },
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return res.text();
}
```

---

## 4. 采集器详细设计

### 4.1 Product Hunt 采集器

```typescript
// producthunt.ts

import Firecrawl from "firecrawl";
import { fetchHtml } from "./shared/http.js";
import { saveItems } from "./shared/storage.js";
import type { ExternalFeedItem, FeedCollector, SaveResult } from "./shared/types.js";

interface ProductHuntItem {
  rank: number;
  name: string;
  tagline: string;
  description: string;
  score: number;
  comments: number;
  topics: string[];
  url: string;
  externalUrl: string;
  imageUrl: string;
}

export class ProductHuntCollector implements FeedCollector {
  source = "producthunt" as const;

  /** 抓取指定日期的 PH Daily Leaderboard */
  async fetchByDate(date: string): Promise<ExternalFeedItem[]> {
    const [year, month, day] = date.split("-");
    const url = `https://www.producthunt.com/leaderboard/daily/${year}/${month}/${day}`;
    console.log(`[producthunt] Fetching ${url}`);

    // 优先使用 Firecrawl JSON 提取
    try {
      return await this.fetchWithFirecrawl(url, date);
    } catch (err) {
      console.warn("[producthunt] Firecrawl failed, falling back to HTML:", err);
      return await this.fetchWithHtml(url, date);
    }
  }

  /** 抓取今天的 PH 数据 */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const today = new Date().toISOString().split("T")[0];
    return this.fetchByDate(today);
  }

  /** 保存到 JSON */
  async save(date: string): Promise<SaveResult> {
    const items = await this.fetchByDate(date);
    return saveItems("producthunt", items, date);
  }

  private async fetchWithFirecrawl(url: string, date: string): Promise<ExternalFeedItem[]> {
    const firecrawl = new Firecrawl();
    const result = await firecrawl.scrape(url, {
      formats: [{
        type: "json",
        schema: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  rank: { type: "number" },
                  name: { type: "string" },
                  tagline: { type: "string" },
                  description: { type: "string" },
                  score: { type: "number" },
                  comments: { type: "number" },
                  topics: { type: "array", items: { type: "string" } },
                  url: { type: "string" },
                  externalUrl: { type: "string" },
                  imageUrl: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
        },
      }],
      timeout: 60000,
    });

    // @ts-ignore
    const data = result.json as { products?: ProductHuntItem[] };
    if (!data?.products) return [];

    return data.products.map((p) => this.normalize(p, date));
  }

  private async fetchWithHtml(url: string, date: string): Promise<ExternalFeedItem[]> {
    // HTML 解析 fallback — 提取结构化数据
    const html = await fetchHtml(url);
    // 使用正则或 cheerio 解析 HTML
    // TODO: 实现 HTML 解析逻辑
    console.warn("[producthunt] HTML parsing not yet implemented");
    return [];
  }

  private normalize(item: ProductHuntItem, date: string): ExternalFeedItem {
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: `producthunt-${date}-${item.rank}`,
      source: "producthunt",
      title: item.name,
      tagline: item.tagline || "",
      description: item.description || "",
      url: item.url || `https://www.producthunt.com/products/${slug}`,
      externalUrl: item.externalUrl || null,
      imageUrl: item.imageUrl || null,
      categories: item.topics || [],
      metrics: {
        score: item.score,
        comments: item.comments,
      },
      metadata: {
        rank: item.rank,
        date,
      },
      fetchedAt: new Date().toISOString(),
      publishedAt: date,
    };
  }
}
```

### 4.2 YC Companies 采集器

```typescript
// yc-companies.ts

import { fetchJson } from "./shared/http.js";
import { saveItems } from "./shared/storage.js";
import type { ExternalFeedItem, FeedCollector, SaveResult } from "./shared/types.js";

interface YCCompany {
  id: number;
  name: string;
  slug: string;
  website: string;
  smallLogoUrl: string | null;
  oneLiner: string;
  longDescription: string;
  teamSize: number;
  url: string;
  batch: string;
  tags: string[];
  status: string;
  industries: string[];
  regions: string[];
  locations: string[];
  badges: string[];
}

interface YCApiResponse {
  companies: YCCompany[];
  nextPage: string | null;
  page: number;
  totalPages: number;
}

/** 默认关注的 AI 相关批次 */
const DEFAULT_BATCHES = [
  "W24", "S24",        // 2024
  "F25", "W25", "X25", // 2025
  "P26",               // 2026
];

export class YCCompaniesCollector implements FeedCollector {
  source = "yc" as const;

  private batches: string[];
  private query: string;

  constructor(options?: { batches?: string[]; query?: string }) {
    this.batches = options?.batches || DEFAULT_BATCHES;
    this.query = options?.query || "ai";
  }

  /** 拉取所有指定批次的 AI 公司 */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const allItems: ExternalFeedItem[] = [];

    for (const batch of this.batches) {
      const items = await this.fetchBatch(batch);
      allItems.push(...items);
    }

    // 去重（按 id）
    const deduped = [...new Map(allItems.map((i) => [i.id, i])).values()];
    console.log(`[yc] Fetched ${deduped.length} companies across ${this.batches.length} batches`);
    return deduped;
  }

  /** 拉取单个批次的所有公司（分页） */
  async fetchBatch(batch: string): Promise<ExternalFeedItem[]> {
    const items: ExternalFeedItem[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const params = new URLSearchParams({ page: String(page) });
      if (this.query) params.set("q", this.query);
      // 支持多批次
      for (const b of batch.split(",")) {
        params.append("batch", b.trim());
      }

      const url = `https://api.ycombinator.com/v0.1/companies?${params}`;
      console.log(`[yc] GET ${url}`);

      const data = await fetchJson<YCApiResponse>(url);
      totalPages = data.totalPages;

      for (const company of data.companies) {
        items.push(this.normalize(company));
      }

      page++;
    }

    return items;
  }

  /** 保存到 JSON（按批次分文件） */
  async save(): Promise<SaveResult[]> {
    const results: SaveResult[] = [];

    for (const batch of this.batches) {
      const items = await this.fetchBatch(batch);
      const result = saveItems("yc", items, batch, `batch-${batch}.json`);
      results.push(result);
    }

    return results;
  }

  private normalize(company: YCCompany): ExternalFeedItem {
    return {
      id: `yc-${company.id}`,
      source: "yc",
      title: company.name,
      tagline: company.oneLiner || "",
      description: company.longDescription || "",
      url: company.url,
      externalUrl: company.website || null,
      imageUrl: company.smallLogoUrl || null,
      categories: [...(company.industries || []), ...(company.tags || [])],
      metrics: {
        teamSize: company.teamSize,
        batch: company.batch,
        status: company.status,
      },
      metadata: {
        ycompanyId: company.id,
        slug: company.slug,
        batch: company.batch,
        industries: company.industries,
        regions: company.regions,
        locations: company.locations,
        badges: company.badges,
        tags: company.tags,
      },
      fetchedAt: new Date().toISOString(),
      publishedAt: null,
    };
  }
}
```

### 4.3 a16z Portfolio 采集器

```typescript
// a16z-portfolio.ts

import { fetchJson } from "./shared/http.js";
import { saveItems } from "./shared/storage.js";
import type { ExternalFeedItem, FeedCollector, SaveResult } from "./shared/types.js";

/** a16z AI 投资公司（静态列表，定期更新） */
const A16Z_AI_COMPANIES = [
  // 基础模型
  { name: "OpenAI", website: "https://openai.com", github: "openai", tags: ["LLM", "Foundation Model"] },
  { name: "Mistral AI", website: "https://mistral.ai", github: "mistralai", tags: ["LLM", "Open Source"] },
  { name: "xAI", website: "https://x.ai", github: "xai-org", tags: ["LLM"] },
  { name: "Safe Superintelligence", website: "https://safe.ai", github: null, tags: ["Safety"] },

  // AI 应用
  { name: "Character.AI", website: "https://character.ai", github: null, tags: ["Chatbot", "Consumer"] },
  { name: "Cursor", website: "https://cursor.com", github: null, tags: ["IDE", "Coding"] },
  { name: "Harvey", website: "https://harvey.ai", github: null, tags: ["Legal", "Enterprise"] },
  { name: "Hebbia", website: "https://hebbia.ai", github: null, tags: ["Knowledge", "Enterprise"] },
  { name: "ElevenLabs", website: "https://elevenlabs.io", github: null, tags: ["Voice", "Audio"] },
  { name: "Ideogram", website: "https://ideogram.ai", github: null, tags: ["Image Generation"] },
  { name: "Runway", website: "https://runwayml.com", github: null, tags: ["Video Generation"] },
  { name: "Gamma", website: "https://gamma.app", github: null, tags: ["Productivity", "Presentations"] },
  { name: "World Labs", website: "https://worldlabs.ai", github: null, tags: ["Spatial Intelligence"] },

  // 基础设施
  { name: "Databricks", website: "https://databricks.com", github: "databricks", tags: ["Data", "ML Platform"] },
  { name: "Anyscale", website: "https://anyscale.com", github: "anyscale", tags: ["Distributed Computing"] },
  { name: "Replicate", website: "https://replicate.com", github: "replicate", tags: ["Model Serving"] },
  { name: "Pinecone", website: "https://pinecone.io", github: null, tags: ["Vector Database"] },
  { name: "Fal.ai", website: "https://fal.ai", github: null, tags: ["Media AI"] },
  { name: "Exa", website: "https://exa.ai", github: null, tags: ["Search"] },
  { name: "OpenRouter", website: "https://openrouter.ai", github: null, tags: ["LLM Gateway"] },

  // 开发工具
  { name: "Sourcegraph", website: "https://sourcegraph.com", github: "sourcegraph", tags: ["Code Search", "AI Coding"] },
  { name: "Promptfoo", website: "https://promptfoo.dev", github: "promptfoo", tags: ["LLM Evaluation"] },
  { name: "Black Forest Labs", website: "https://blackforestlabs.ai", github: "black-forest-labs", tags: ["Image Generation", "Open Source"] },
  { name: "Civitai", website: "https://civitai.com", github: "civitai", tags: ["AI Models", "Community"] },
  { name: "Hedra", website: "https://hedra.com", github: "hedra-labs", tags: ["Video Generation"] },
  { name: "fal", website: "https://fal.ai", github: null, tags: ["Media AI"] },
];

interface GitHubRepoInfo {
  stargazers_count: number;
  description: string;
  html_url: string;
}

export class A16zPortfolioCollector implements FeedCollector {
  source = "a16z" as const;

  /** 获取 a16z AI 投资组合 */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const items: ExternalFeedItem[] = [];

    for (const company of A16Z_AI_COMPANIES) {
      let githubStars: number | undefined;
      let githubDescription: string | undefined;

      // 如果有 GitHub org，尝试获取仓库信息
      if (company.github) {
        try {
          const repoInfo = await this.fetchGitHubInfo(company.github);
          githubStars = repoInfo?.stargazers_count;
          githubDescription = repoInfo?.description;
        } catch {
          // GitHub API 失败不影响主流程
        }
      }

      items.push(this.normalize(company, githubStars, githubDescription));
    }

    console.log(`[a16z] Fetched ${items.length} AI portfolio companies`);
    return items;
  }

  /** 保存到 JSON */
  async save(): Promise<SaveResult> {
    const items = await this.fetchLatest();
    return saveItems("a16z", items, "portfolio");
  }

  private async fetchGitHubInfo(org: string): Promise<GitHubRepoInfo | null> {
    try {
      // 尝试获取 org 下最热门的仓库
      const repos = await fetchJson<GitHubRepoInfo[]>(
        `https://api.github.com/orgs/${org}/repos?sort=stars&per_page=1`,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      return repos[0] || null;
    } catch {
      return null;
    }
  }

  private normalize(
    company: (typeof A16Z_AI_COMPANIES)[number],
    stars?: number,
    ghDescription?: string,
  ): ExternalFeedItem {
    return {
      id: `a16z-${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      source: "a16z",
      title: company.name,
      tagline: ghDescription || "",
      description: "",
      url: `https://a16z.com/portfolio/`,
      externalUrl: company.website,
      imageUrl: null,
      categories: company.tags,
      metrics: {
        stars,
      },
      metadata: {
        investor: "a16z",
        github: company.github,
        tags: company.tags,
      },
      fetchedAt: new Date().toISOString(),
      publishedAt: null,
    };
  }
}
```

### 4.4 统一 VC 同步编排

```typescript
// vc-portfolio.ts

import { YCCompaniesCollector } from "./yc-companies.js";
import { A16zPortfolioCollector } from "./a16z-portfolio.js";
import type { FeedSource } from "./shared/types.js";

export interface SyncOptions {
  sources?: FeedSource[];
  ycBatches?: string[];
  ycQuery?: string;
}

/** 同步所有 VC Portfolio 数据源 */
export async function syncVCPortfolio(options: SyncOptions = {}): Promise<void> {
  const sources = options.sources || ["yc", "a16z"];

  if (sources.includes("yc")) {
    console.log("[vc-sync] Syncing YC Companies...");
    const yc = new YCCompaniesCollector({
      batches: options.ycBatches,
      query: options.ycQuery,
    });
    const results = await yc.save();
    for (const r of results) {
      console.log(`[vc-sync] YC ${r.source}: ${r.count} items -> ${r.outDir}`);
    }
  }

  if (sources.includes("a16z")) {
    console.log("[vc-sync] Syncing a16z Portfolio...");
    const a16z = new A16zPortfolioCollector();
    const result = await a16z.save();
    console.log(`[vc-sync] a16z: ${result.count} items -> ${result.outDir}`);
  }

  console.log("[vc-sync] Done.");
}
```

---

## 5. API 端点设计

### 5.1 新增端点

```typescript
// server.ts 中新增

import { readManifest, getSourceDir } from "./collector/shared/storage.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/** GET /api/feeds/producthunt — 最新 PH 数据 */
app.get("/api/feeds/producthunt", (c) => {
  const manifest = readManifest("producthunt");
  if (!manifest || manifest.entries.length === 0) {
    return c.json({ items: [], count: 0 });
  }
  const latest = manifest.entries[manifest.entries.length - 1];
  const dir = getSourceDir("producthunt");
  const data = JSON.parse(readFileSync(join(dir, latest.filename), "utf-8"));
  return c.json({ items: data.items, count: data.count, date: latest.label });
});

/** GET /api/feeds/producthunt/:date — 指定日期的 PH 数据 */
app.get("/api/feeds/producthunt/:date", (c) => {
  const date = c.req.param("date");
  const dir = getSourceDir("producthunt");
  const filePath = join(dir, `${date}.json`);
  if (!existsSync(filePath)) {
    return c.json({ error: "Not found" }, 404);
  }
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  return c.json(data);
});

/** GET /api/feeds/yc — YC AI 公司 */
app.get("/api/feeds/yc", (c) => {
  const batch = c.req.query("batch");
  const manifest = readManifest("yc");
  if (!manifest) return c.json({ items: [], count: 0 });

  const dir = getSourceDir("yc");
  let items: any[] = [];

  if (batch) {
    const filePath = join(dir, `batch-${batch}.json`);
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      items = data.items || [];
    }
  } else {
    // 合并所有批次
    for (const entry of manifest.entries) {
      const data = JSON.parse(readFileSync(join(dir, entry.filename), "utf-8"));
      items.push(...(data.items || []));
    }
  }

  return c.json({ items, count: items.length });
});

/** GET /api/feeds/a16z — a16z AI Portfolio */
app.get("/api/feeds/a16z", (c) => {
  const dir = getSourceDir("a16z");
  const filePath = join(dir, "portfolio.json");
  if (!existsSync(filePath)) {
    return c.json({ items: [], count: 0 });
  }
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  return c.json(data);
});

/** GET /api/feeds/vc — 统一 VC Feed（合并 yc + a16z） */
app.get("/api/feeds/vc", (c) => {
  const source = c.req.query("source"); // "yc" | "a16z" | undefined
  const sources = source ? [source as FeedSource] : ["yc", "a16z"];
  const items: ExternalFeedItem[] = [];

  for (const src of sources) {
    const manifest = readManifest(src);
    if (!manifest) continue;
    const dir = getSourceDir(src);
    for (const entry of manifest.entries) {
      const data = JSON.parse(readFileSync(join(dir, entry.filename), "utf-8"));
      items.push(...(data.items || []));
    }
  }

  return c.json({ items, count: items.length });
});
```

### 5.2 CLI 命令

```typescript
// cli.ts 中新增

case "sync":
  switch (args[1]) {
    case "producthunt":
      const ph = new ProductHuntCollector();
      const phDate = args[2] || new Date().toISOString().split("T")[0];
      const phResult = await ph.save(phDate);
      console.log(`Saved ${phResult.count} PH items to ${phResult.outDir}`);
      break;

    case "yc":
      const yc = new YCCompaniesCollector({ batches: args.slice(2) });
      const ycResults = await yc.save();
      for (const r of ycResults) {
        console.log(`Saved ${r.count} YC items to ${r.outDir}`);
      }
      break;

    case "a16z":
      const a16z = new A16zPortfolioCollector();
      const a16zResult = await a16z.save();
      console.log(`Saved ${a16zResult.count} a16z items to ${a16zResult.outDir}`);
      break;

    case "vc":
      await syncVCPortfolio({ sources: args.slice(2) as FeedSource[] });
      break;
  }
```

---

## 6. 前端集成设计

### 6.1 新增页面路由

```
frontend/src/pages/
├── __root/          # 现有
├── index/           # 现有 → 重定向到 /trending
├── trending/        # 现有
├── starred/         # 现有
├── producthunt/     # 新增
│   ├── page.tsx
│   └── route.tsx
└── vc/              # 新增 — 统一 VC 页面
    ├── page.tsx
    └── route.tsx
```

### 6.2 侧边栏扩展

```tsx
// __root layout 中新增导航项
<nav>
  <NavLink to="/trending">GitHub Trending</NavLink>
  <NavLink to="/starred">Starred Repos</NavLink>
  <NavLink to="/producthunt">Product Hunt</NavLink>
  <NavLink to="/vc">YC / a16z</NavLink>
</nav>
```

---

## 7. 实施计划

| 阶段 | 内容 | 文件 | 依赖 |
|------|------|------|------|
| **1** | 共享模块 | `collector/shared/types.ts`, `storage.ts`, `http.ts` | 无 |
| **2** | Product Hunt 采集器 | `collector/producthunt.ts` | 阶段 1, Firecrawl |
| **3** | YC Companies 采集器 | `collector/yc-companies.ts` | 阶段 1 |
| **4** | a16z Portfolio 采集器 | `collector/a16z-portfolio.ts` | 阶段 1 |
| **5** | 统一同步编排 | `collector/vc-portfolio.ts` | 阶段 3, 4 |
| **6** | API 端点 | `app/server.ts` | 阶段 2-5 |
| **7** | CLI 命令 | `app/cli.ts` | 阶段 2-5 |
| **8** | 前端页面 | `frontend/src/pages/` | 阶段 6 |

---

## 8. 注意事项

### 8.1 Product Hunt 抓取

- PH 没有公开 API，只能通过页面抓取
- Leaderboard 页面是服务端渲染的，可以直接 fetch HTML
- Firecrawl JSON 提取是首选方案（项目已有集成）
- 需要遵守 PH 的 robots.txt 和使用条款
- 建议限制抓取频率（每天 1 次）

### 8.2 YC API

- 公开 API，无需认证
- 有分页限制（每页 20 条）
- 需要遍历多页获取完整数据
- 数据量大时（50+ 页），建议限制批次范围

### 8.3 a16z 数据

- 投资列表页是客户端渲染，需要 JavaScript 执行
- 当前设计使用静态列表 + GitHub API 补充
- 需要定期手动更新列表（月度）
- 未来可考虑使用 Firecrawl 抓取完整投资列表

### 8.4 存储

- 所有新数据源使用 JSON 存储（不修改 SQLite schema）
- 遵循 digest 模式：manifest.json + 按日期/批次分文件
- 支持增量更新（覆盖同名文件）
- 前端静态模式需要导出到 `frontend/public/data/`
