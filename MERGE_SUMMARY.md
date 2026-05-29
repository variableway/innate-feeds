# Trending 服务合并到 Innate Hub — 总结文档

## 合并概述

`trending-backend`（Go 后端）和 `trending-web`（React 前端）已合并到 `innate-hub` 中。

- **trending-web 已废弃**：innate-hub 前端已足够，不再维护独立的 trending 前端。
- **trending-backend 已迁移**：核心能力（GitHub Trending / Starred / Product Hunt）已作为 `innate-hub` 的子模块集成。

---

## 合并后的架构

```
innate-hub/
├── backend/
│   ├── cmd/hub/main.go                 # 主服务入口
│   ├── cmd/trending-cli/main.go        # CLI 工具（fetch / list）
│   ├── cmd/trending-tui/main.go        # TUI 终端界面
│   ├── internal/
│   │   ├── handler/
│   │   │   ├── handler.go              # 主路由（/api/groups, /api/feeds, ...）
│   │   │   └── trending.go             # Trending API 路由
│   │   ├── adapter/
│   │   │   ├── githubtrending/         # GitHub Trending Adapter
│   │   │   ├── producthunt/            # Product Hunt Adapter
│   │   │   ├── rss/                    # RSS Adapter
│   │   │   └── trendradar/             # TrendRadar Adapter
│   │   └── trending/                   # ★ 新增：Trending 子系统
│   │       ├── pkg/github/client.go    # GitHub API 客户端
│   │       ├── pkg/producthunt/client.go # Product Hunt API 客户端
│   │       ├── model/model.go          # 数据模型（3 张表）
│   │       ├── store/store.go          # GORM Store 层
│   │       ├── service/                # 业务逻辑层
│   │       └── ...
│   └── go.mod                          # 新增 GORM / Cobra / Bubble Tea 依赖
│
├── frontend/                           # 原有 Feed 阅读器前端
│   └── ...
│
└── TrendRadar/                         # 独立子项目（热点新闻爬虫）
```

---

## 新增 API 端点

所有 Trending 端点挂载在 `/api/trending/*`，复用 innate-hub 的认证中间件（session / API Key）。

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/trending/stats` | 统计（总数 + 最后抓取时间） |
| GET | `/api/trending/github/trending` | Trending 列表（period/language/limit/offset） |
| POST | `/api/trending/github/trending/fetch` | 触发抓取 |
| GET | `/api/trending/github/trending/languages` | 语言列表 |
| GET | `/api/trending/github/starred/:username` | Starred 列表 |
| POST | `/api/trending/github/starred/fetch` | 触发 Starred 抓取 |
| GET | `/api/trending/github/starred/:username/languages` | 语言分布统计 |
| GET | `/api/trending/producthunt` | Product Hunt 列表 |
| POST | `/api/trending/producthunt/fetch` | 触发 Product Hunt 抓取 |
| GET | `/api/trending/producthunt/categories` | 分类列表 |

---

## 新增 Adapter（Feed 源）

GitHub Trending 和 Product Hunt 现在可以作为 Feed 源接入 innate-hub 的 Feed 体系：

- **githubtrending**：读取 GitHub Trending 页面，输出标准 `[]model.Item`
- **producthunt**：读取 Product Hunt GraphQL API，输出标准 `[]model.Item`

这意味着：
- GitHub Trending / Product Hunt 内容会自动进入 `items` 表
- 支持 innate-hub 的**全文搜索**、**语义搜索**、**书签**、**已读/未读**
- 前端无需专门页面，直接用现有 Feed 阅读器浏览

---

## 保留的 CLI + TUI

```bash
# CLI
cd innate-hub/backend
go run ./cmd/trending-cli fetch github-trending --period daily
go run ./cmd/trending-cli list github-starred octocat

# TUI
go run ./cmd/trending-tui
```

两者都直接连接 innate-hub 的数据库（默认 `fusion.db`），可通过 `--db` 指定路径或 PostgreSQL DSN。

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `GITHUB_TOKEN` | GitHub PAT（提高 API 速率限制） |
| `PRODUCTHUNT_TOKEN` | Product Hunt API Token |
| `GITHUB_API_URL` | GitHub API URL（默认 https://api.github.com） |
| `PRODUCTHUNT_API_URL` | Product Hunt API URL（默认 https://api.producthunt.com/v2/api/graphql） |

---

## 数据库表

新增三张表，与 innate-hub 原有表共享同一个数据库：

- `github_trending` — GitHub Trending 仓库
- `github_starred` — 用户 Starred 仓库
- `product_hunt` — Product Hunt 产品

GORM AutoMigrate 在启动时自动创建/更新表结构。

---

## 技术决策说明

1. **为什么保留 GORM？** innate-hub 使用 `database/sql`，但重写整个 trending store 为原生 SQL 工作量巨大。选择从 `*sql.DB` 桥接 GORM， trending 表用 GORM 管理，innate-hub 原有表保持 `database/sql` 不变。
2. **为什么废弃 trending-web？** innate-hub 前端已是 React + shadcn/ui，功能重叠。Trending 内容通过 Adapter 进入 Feed 体系后，可用现有前端直接浏览。如需专门 Starred 界面，可在 innate-hub 前端中后续扩展。
3. **GitHub Starred 为什么不走 Adapter？** Starred 需要动态用户名参数，不适合标准 Feed 模型（Feed 通常是固定源）。因此保留为独立 API。
