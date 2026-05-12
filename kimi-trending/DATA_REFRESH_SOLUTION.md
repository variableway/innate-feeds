# Trending Aggregator — 可持续数据刷新方案

## 问题分析

当前前端使用硬编码 Mock 数据，无法自动更新。要获取"每天全新的数据"，需要一套自动化的数据获取和部署流程。

---

## 方案对比

| 方案 | 复杂度 | 成本 | 实时性 | 推荐度 |
|------|--------|------|--------|--------|
| **A. GitHub Actions 每日构建** | 低 | 免费 | 每天更新 | ⭐⭐⭐⭐⭐ |
| **B. 部署 Go 后端** | 中 | 免费/低 | 实时 API | ⭐⭐⭐⭐ |
| **C. Cloudflare Worker 代理** | 低 | 免费 | 实时 API | ⭐⭐⭐⭐ |

---

## 方案 A：GitHub Actions 每日自动构建（最推荐）

**原理**：每天定时运行 GitHub Actions，抓取最新数据生成静态 JSON，构建并部署前端。

**优势**：
- 完全免费（GitHub Actions 免费额度足够）
- 无需运维服务器
- 数据每天自动刷新
- 构建产物可部署到任何静态托管

### 文件结构

```
trending-web/
├── scripts/
│   └── fetch-data.js          # 数据抓取脚本
├── public/
│   └── data/                  # 生成的数据目录
│       ├── trending.json
│       ├── starred.json
│       ├── producthunt.json
│       └── stats.json
├── .github/
│   └── workflows/
│       └── daily-update.yml   # 定时工作流
└── src/
    └── lib/
        └── api.ts             # 改为读取 JSON 文件
```

### 1. 数据抓取脚本 (scripts/fetch-data.js)

```javascript
/**
 * 每日数据抓取脚本
 * 运行方式: node scripts/fetch-data.js
 * 抓取 GitHub Trending + Product Hunt 数据，生成静态 JSON
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ===== GitHub Trending 抓取 =====
async function fetchGitHubTrending() {
  console.log('Fetching GitHub Trending...');
  
  const repos = [];
  const periods = ['daily', 'weekly', 'monthly'];
  
  for (const period of periods) {
    try {
      // 方法1: 使用 GitHub API Search（无需认证，有 rate limit）
      const since = period === 'daily' ? 'created:>2024-01-01' 
                  : period === 'weekly' ? 'created:>2023-12-01' 
                  : 'created:>2023-06-01';
      
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(since)}&sort=stars&order=desc&per_page=25`;
      
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Trending-Aggregator/1.0',
          ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
        }
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      const items = data.items.map((item, idx) => ({
        id: item.id || idx + 1,
        repo_name: item.name,
        owner: item.owner.login,
        full_name: item.full_name,
        description: item.description || '',
        language: item.language || 'Unknown',
        stars: item.stargazers_count || 0,
        stars_today: Math.floor((item.stargazers_count || 0) * 0.01), // 估算
        forks: item.forks_count || 0,
        period: period,
        fetched_at: new Date().toISOString(),
        url: item.html_url,
        contributors: 0
      }));
      
      repos.push(...items);
      console.log(`  ${period}: ${items.length} repos`);
    } catch (err) {
      console.error(`  ${period} failed:`, err.message);
    }
  }
  
  return repos;
}

// ===== Product Hunt 抓取 =====
async function fetchProductHunt() {
  console.log('Fetching Product Hunt...');
  
  // 使用 Product Hunt GraphQL API
  const token = process.env.PRODUCTHUNT_TOKEN;
  if (!token) {
    console.log('  No PRODUCTHUNT_TOKEN, using fallback data');
    return [];
  }
  
  try {
    const query = `
      query {
        posts(order: RANKING, first: 30, postedAfter: "${new Date().toISOString().split('T')[0]}T00:00:00Z") {
          nodes {
            id
            name
            tagline
            description
            url
            votesCount
            commentsCount
            featured
            createdAt
            makers { name username }
            topics { nodes { name } }
            thumbnail { url }
          }
        }
      }
    `;
    
    const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    const data = await res.json();
    const items = (data.data?.posts?.nodes || []).map((item, idx) => ({
      id: idx + 1,
      product_id: item.id,
      name: item.name,
      tagline: item.tagline || '',
      description: item.description || '',
      url: item.url,
      thumbnail: item.thumbnail?.url || '',
      votes_count: item.votesCount || 0,
      comments_count: item.commentsCount || 0,
      makers: JSON.stringify(item.makers || []),
      topics: JSON.stringify((item.topics?.nodes || []).map((t) => t.name)),
      day: new Date().toISOString().split('T')[0],
      featured: item.featured || false
    }));
    
    console.log(`  ${items.length} products`);
    return items;
  } catch (err) {
    console.error('  Failed:', err.message);
    return [];
  }
}

// ===== 生成统计数据 =====
function generateStats(trending, producthunt) {
  const now = new Date().toISOString();
  return {
    total_trending: trending.length,
    total_starred: 0,
    total_producthunt: producthunt.length,
    last_fetch_trending: now,
    last_fetch_starred: now,
    last_fetch_producthunt: now
  };
}

// ===== 主函数 =====
async function main() {
  console.log('=== Trending Data Fetch ===');
  console.log('Time:', new Date().toISOString());
  
  const trending = await fetchGitHubTrending();
  const producthunt = await fetchProductHunt();
  const stats = generateStats(trending, producthunt);
  
  // 写入文件
  fs.writeFileSync(path.join(DATA_DIR, 'trending.json'), 
    JSON.stringify({ data: trending, total: trending.length, limit: 100, offset: 0 }, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'producthunt.json'), 
    JSON.stringify({ data: producthunt, total: producthunt.length, limit: 100, offset: 0 }, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'stats.json'), 
    JSON.stringify(stats, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'languages.json'), 
    JSON.stringify([...new Set(trending.map(r => r.language).filter(Boolean))], null, 2));
  
  console.log('\nFiles written to public/data/');
  console.log('  trending.json:', trending.length, 'items');
  console.log('  producthunt.json:', producthunt.length, 'items');
  console.log('Done!');
}

main().catch(console.error);
```

### 2. GitHub Actions 工作流 (.github/workflows/daily-update.yml)

```yaml
name: Daily Data Update

on:
  # 每天 UTC 08:00 运行（北京时间 16:00）
  schedule:
    - cron: '0 8 * * *'
  # 支持手动触发
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Fetch latest data
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PRODUCTHUNT_TOKEN: ${{ secrets.PRODUCTHUNT_TOKEN }}
        run: node scripts/fetch-data.js

      - name: Build site
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### 3. 前端 API 修改 (src/lib/api.ts)

```typescript
// 关键修改：Mock 模式下读取静态 JSON 而非硬编码数据
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// Mock 时从 public/data/*.json 读取
async function mockJson<T>(filename: string): Promise<T> {
  const res = await fetch(`/data/${filename}.json`);
  if (!res.ok) throw new Error(`Failed to load ${filename}`);
  return res.json() as Promise<T>;
}

// api.getTrending 修改：
getTrending: async (params) => {
  if (USE_MOCK) {
    const all = await mockJson<ApiResponse<GitHubTrending>>('trending');
    let data = all.data;
    if (params.period) data = data.filter(r => r.period === params.period);
    if (params.language) data = data.filter(r => r.language === params.language);
    return { ...all, data, total: data.length };
  }
  // ... 原有代码
}
```

### 4. 部署方式

| 平台 | 步骤 |
|------|------|
| **GitHub Pages** | Actions 中已包含，push 到 gh-pages 分支 |
| **Vercel** | 连接 GitHub repo，自动部署 + 可配置每日 Webhook 触发 |
| **Netlify** | 类似 Vercel，支持定时构建 |
| **自有服务器** | Actions 中 SCP 上传或使用 rsync |

---

## 方案 B：部署 Go 后端（最强大）

已有的 Go 后端包含：
- GitHub HTML 抓取（trending）+ API（starred）
- Product Hunt GraphQL API
- 定时任务（gocron）
- SQLite/PostgreSQL 存储

### 部署步骤

```bash
# 1. 部署到 Render（免费）
# - 创建 Render Web Service
# - 连接 GitHub repo
# - 构建命令: go build -o app ./cmd/api
# - 启动命令: ./app
# - 环境变量: DB_DRIVER=sqlite, GITHUB_TOKEN=xxx

# 2. 部署到 Railway（免费额度）
railway login
railway init
railway up

# 3. 部署到 Fly.io（免费）
fly launch
fly deploy
```

### 前端连接

```typescript
// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'https://your-backend.onrender.com/api/v1';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'; // 默认关闭 Mock
```

---

## 方案 C：Cloudflare Worker 代理（最轻量）

如果不想维护完整后端，可在 Cloudflare Workers 上部署轻量级代理。

```typescript
// worker.ts
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/trending') {
      // 抓取 GitHub Trending HTML 并解析
      const repos = await scrapeGitHubTrending();
      return new Response(JSON.stringify({ data: repos }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    if (url.pathname === '/api/producthunt') {
      const products = await fetchProductHunt(env.PH_TOKEN);
      return new Response(JSON.stringify({ data: products }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

部署:
```bash
npm install -g wrangler
wrangler login
wrangler deploy worker.ts
```

---

## 推荐的实施路径

**Phase 1（本周）**：实施方案 A
- 添加 `scripts/fetch-data.js`
- 添加 `.github/workflows/daily-update.yml`
- 修改 `src/lib/api.ts` 读取 JSON 文件
- 数据立即开始每日自动更新

**Phase 2（可选）**：实施方案 B
- 部署 Go 后端到 Render/Fly.io
- 前端切换为真实 API
- 获得实时数据 + 用户 starred 功能

**Phase 3（可选）**：混合架构
- Cloudflare Worker 作为 CDN 缓存层
- Go 后端作为数据源
- 全球低延迟访问

---

## 环境变量配置

| 变量 | 说明 | 获取方式 |
|------|------|----------|
| `GITHUB_TOKEN` | GitHub API Token | github.com/settings/tokens |
| `PRODUCTHUNT_TOKEN` | Product Hunt Dev Token | app.producthunt.com/oauth/applications |
| `VITE_API_URL` | 后端 API 地址 | 部署后获得 |
| `VITE_USE_MOCK` | 是否使用 Mock | `true`/`false` |

---

## 注意事项

1. **GitHub API Rate Limit**: 无认证 60/hr，有 Token 5000/hr
2. **Product Hunt API**: 需要免费 Developer Token
3. **数据准确性**: GitHub Search API 的排序与官方 Trending 页面略有差异
4. **备份策略**: 每次构建前备份昨日数据到 `data/archive/` 目录
