# EduOS GitHub Radar 源码机制分析

> 调研日期：2026-11-02。源码：[ywEdAi/eduos-github-radar](https://github.com/ywEdAi/eduos-github-radar)，clone 到 `references/eduos-github-radar/`（gitignored，不入库）。25 commits，末次提交 2026-10-10。
>
> 定位：一个**双语（中英）、纯元数据（metadata-only）的教育开源项目目录**。采集 GitHub 公开元数据 → JSONL 注册表 → 字段白名单公开快照 → 静态站 + Next.js 前端。它最值得学的不是功能，而是**数据治理与信任边界的工程化**。

## 0. 关键结论（先读这里）

1. **全套采集器零第三方依赖**：`scripts/` 全部是 Python 3.10+ 标准库（urllib/json/hashlib/fcntl），共约 3800 行（采集 2800 + 前端 JS 480）。没有 pip install，没有框架。对比之下我们 backend 走 Bun + Hono，但它证明了「小工具零依赖」的可维护性路线。
2. **采集与展示强制分离**：collector 只写注册表；website 只读「生成的公开快照」。两层之间唯一通道是 `build_site.py` 的**字段白名单导出**——本地注册表可以很大很杂（3614 条），公开快照必须过闸（1043 条）。这是和我们「API 模式 + 静态模式」双轨完全不同但目标相似的架构。
3. **纪律化的 API 预算**：ETag 条件请求（304 不占主速率限额）、搜索节流（认证 2.1s / 匿名 6.2s 串行）、`Retry-After` / `X-RateLimit-Reset` 精确等待、每次运行的查询数/manifest 数/请求总数全部有硬预算（8 查询 / 24 manifest / 100 请求）。README 明文「broad crawling must stay out of public page requests」。
4. **每条记录带完整 provenance 链**：`first_seen` / `last_seen` / `fetched_at` / `checked_at` + `provenance[]`（来源、source_ref、query_id、lead_id、时间戳）。404 不当作删除证据（`GitHubAPIError` 保留原状态），改名/消失的 repo 保留为可审计状态。这正是我们 #39 想做的「按时间识别新 repo」的加强版：他们连「何时何地由哪个查询发现」都固化在数据里。
5. **信任边界写进代码而不是文案**：license 观察（sha256 证据 + curator 复核 `reviewed_sha256`）、`reuse_status`（license-observed / restricted / link-only / needs-review）、demo 可达性探测（且强制「源仓库不是 demo」校验）、`runtime_tested: False` 硬编码——「不做深度代码分析、不背书质量」直接体现在 schema 与校验器里。
6. **发布有事务性**：`update_directory.py` 用 flock 防并发；运行前先快照 `before-*`；校验失败**不替换**公开数据；每次运行产出 `run-summary.json` + `resource-changes.json` + 数据质量报告。我们的 `data:update:local` 没有这层「失败不污染公开快照」的保证。
7. **与我们高度同构，可低成本互借**：GitHub 数字 ID 去重（同我们 `starred_repos` PK）、`star+json` 式时间语义、双语查询矩阵分族测覆盖/误报（中英文分开查询独立统计）、静态快照 + 客户端过滤。详见 §5 借鉴清单。

## 1. 项目是什么

| 维度 | 内容 |
|---|---|
| 产品 | Edu AI Builders 站点的 `/directory`（Next.js multi-zone 嵌入），独立部署的只读目录 |
| 三个平行馆藏 | Apps & systems（repo）/ Skills（SKILL.md 清单）/ Data & benchmarks（数据集与评测） |
| 数据源 | GitHub REST 元数据 + arXiv API（原型）；明确「GitHub 是来源，不是顶级类目」 |
| 语言 | 采集器 Python 3.10+（零依赖）；前端 Next.js 16 + React + framer-motion；另有零依赖静态站 `site/` |
| 规模（当前快照） | 本地注册表 3614 条（repo 3591 + lead 23）；entity_kind：repo 2383 / dataset 671 / benchmark 317 / awesome_index 243；公开快照 1043；Skills 本地 160 → 公开 85；curated 精选 13；builder-index 1142；论文 ~数百条 |

「high-recall discovery set」是它反复强调的定位：注册表是高召回的**候选发现集**，不是「精选应用」；公开页只保留有教育信号或人工确认的记录。

## 2. 仓库结构与数据流

```text
config/   精确 leads + 中英发现查询矩阵（seeds 32 / query-matrix 32 条×7 族 / builder-discovery 54 查询×18 族）
scripts/  零依赖采集器 + 校验器 + 快照构建器
data/     canonical JSONL 注册表（registry/skills/papers）+ 精选资源 + 运行历史
schema/   独立 JSON Schema 契约（registry / skill-registry / course-resources / paper）
site/     零依赖静态阅读器 + 生成的公开快照
web/      Next.js 公开目录（Vercel 部署根，basePath=/directory）
docs/     GitHub API 语义、部署决策、Skills 路线图
migrations/  未来 Postgres 化的表结构（可选，当前未启用）
```

数据流（采集 → 发布单向）：

```text
config 查询矩阵/leads
      │
      ▼
crawl.py (seed/discover/refresh/hydrate/expand)  ──►  data/registry.jsonl   (高召回, 本地)
crawl_skills.py (树扫描+frontmatter)             ──►  data/skills.jsonl     (160)
collect_builder_skills.py (有预算的轮转发现)      ──►  hints 合并进两表
crawl_papers.py (arXiv Atom)                     ──►  data/papers.jsonl
      │
update_directory.py  [flock + before 快照]
  ├─ refresh: 精选 13 条逐仓核对 (repo+commit+证据文件+license+demo)
  ├─ validate.py / validate_skills.py          失败 → 不发布
  ├─ build_site.py / build_skills_site.py / build_builder_index.py
  │      字段白名单 + 教育信号闸  ──►  site/data/*.json ──copy──►  web/data/*.json
  └─ run-summary.json + resource-changes.json + update-history.jsonl
      │
      ▼
web/ Next.js 客户端过滤/搜索静态 JSON（无 DB 也可跑）；可选 Postgres 只存用户提交建议
```

## 3. 采集器机制（scripts/crawl.py，1094 行）

### 3.1 GitHubClient：纪律化的 HTTP 层

- **凭据**：`GH_TOKEN`/`GITHUB_TOKEN` 环境变量或已登录 `gh` token，绝不落盘、不显示。
- **节流**：普通请求 `--request-interval`（默认串行最小间隔），搜索另加 `search_interval`（认证 2.1s、匿名 6.2s）——因为搜索限额是 30/min（认证）而非 5000/hr。
- **条件请求**：每个成功响应的 `ETag`/`Last-Modified` 存入 `state/http-cache.json`；下次带 `If-None-Match`，收到 304 计数并**不消耗主速率限额**。这是它敢于每天全量 refresh 50 条的资本。
- **退避**：优先 `Retry-After`，再 `x-ratelimit-reset` 精确等待，否则指数退避；`--max-wait` 超过直接失败而不是傻等。
- **语义谨慎**：404 一律携带状态抛 `GitHubAPIError`，调用方显式声明 `expected_404`（如 releases/latest 常无 release）；「404 ≠ repo 已删除，改名/转移同样 404」，refresh 时 404 记录**保留原证据与原核验时间**。

### 3.2 Registry：append-only 语义的 JSONL

- `record_key` 唯一：`repo:{github_repo_id}`（数字 ID 去重，与 GitHub 改名无关）或 `lead:{lead_id}`（未验证的候选名）。
- 时间字段五件套：`first_seen`（首次发现，永不变）/ `last_seen`（最近一次出现在某来源）/ `fetched_at` / `checked_at` / GitHub 侧 `created_at`/`updated_at`/`pushed_at` 分开。
- `provenance[]` 数组：每条记录可同时被 seed、search query、owner expansion、curation 多个来源命中，各自保留 `source`/`source_ref`/`query_id`/`first_seen`/`last_seen`。当前数据里可见 10 种来源（github-search 3520、metadata-hydration 160、incremental-refresh 125、builder-discovery 40、user-image-lead 41…）。
- `entity_kind` 推断：`awesome-*` 前缀或 `awesome-list` topic → awesome_index；名称/描述/topic 命中 `benchmark|bench` → benchmark；`dataset|corpus` → dataset；否则 repo。纯词法规则，README 明示这是「轻量发现形态，不是深度能力分类」。
- hydration 分级：search 命中只存基础元数据（`languages_status: pending`），按 stars 优先队列限量补全 languages + latest release（每仓 3 个请求）。

### 3.3 五个命令

| 命令 | 作用 | 关键点 |
|---|---|---|
| `seed` | 解析精确 owner/repo leads | 名称验证分级 exact/probable/ambiguous/unresolved，不猜测 |
| `discover` | 按 query-matrix 搜索 | 逐查询串行翻页（`Link` header），`incomplete_results` 记警告；发现后按 stars 挑 top `--hydrate-limit` 补全 |
| `refresh` | 已有记录条件刷新 | 全走 ETag，304 零成本；404 保留证据 |
| `hydrate` | 补 languages/release | `--lead-only` 优先补 leads |
| `expand` | owner 展开 / awesome 索引展开 | owner 列公开仓库、shared-topic 邻居扩展，都作为额外 provenance 记录 |

### 3.4 查询矩阵（config/query-matrix.json）

32 条查询 × 7 族：education-native / teaching-workflow / learning-adjacent / capability-primitives / topic-expansion / awesome-list-leads / dataset-benchmark。**中英文同概念分开成两条查询**，以便分别测覆盖率和误报率（docs/github-api.md 明文写了这个设计动机）。search API 单查询上限 1000 条结果/4000 匹配仓，所以矩阵刻意「窄而多」而不是一条大查询。

## 4. Skills、精选资源与治理机制

### 4.1 Skills 采集（crawl_skills.py，301 行）

- 只取三类东西：源仓库元数据、递归 Git tree（找 `SKILL.md` 路径）、manifest 的 **YAML frontmatter 的 name/description 两字段**（自写保守 parser，处理 `|` 块标量折行）。
- **指令正文、脚本、资源文件一律不存**；只从路径结构推断 `resource_hints`（scripts/references/assets 是否存在），并明示「不是安全评估」。
- 去重键 = 仓库数字 ID + manifest 路径；`first_seen` 保留。
- 首批源是策展的 `openai/skills` + `anthropics/skills`；社区源必须人工加进 `config/skill-sources.json`。

### 4.2 Builder 发现（collect_builder_skills.py）

- 预算制：每次运行最多 8 条查询（从 54 条**轮转游标**取）、每查询 8 结果、采样 2、24 次 manifest 尝试、100 次 API 请求。状态存 `state/builder-discovery.json`（游标/页码/采样偏移），下次运行接着转——用固定小额预算持续覆盖大矩阵。
- facet 提示（audiences/subjects/platforms/scenarios/capabilities）来自查询本身的词族，合并进记录时标 `evidence_level: discovery-query-or-curated-source`——**搜索命中的词永远只是线索，不是能力证明**。

### 4.3 精选资源与 license 观察（update_directory.py，394 行）

这是全仓治理最密的部分：

1. 策展配置 `config/education-resources.json`（13 条）声明每条资源的证据文件路径与 license 观察范围。
2. refresh 时逐仓取 `/repos/{name}` + 默认分支最新 commit，**pinned_commit 固定**，拉取证据文件算 sha256。
3. license 观察：比较与上次观察的哈希；文本变了但 curator 未复核（`reviewed_sha256` 不匹配）→ 自动降级 `needs-review` 并报错，**绝不把未核验 license 展示为可复用**（validate 阶段强制）。
4. demo 校验：HTTPS-only、禁止 github.com/raw.githubusercontent.com 冒充 demo（「源仓库不是在线体验」）、读声明路径确认 repo 里真的宣称了这个 demo URL、HTTP 可达才标 `page-reachable`，且 `generation_tested: False` 永远诚实。
5. 发布事务：运行前快照 → 校验 → 构建 → 全部成功才把快照拷进 `site/data` 与 `web/data`；否则公开数据不动。

### 4.4 治理痕迹

`run-log.md`（人读的运行日志，含失败与 token 失效记录）、`data/update-history.jsonl`（8 次运行的结构化摘要）、`data/snapshots/`（每次运行的 before 文件）、`reports/data-quality-*.md`（每次校验报告）。任何一次数据变化都能回答「何时、由谁、改了什么、为什么」。

## 5. 前端与部署

- **web/**：Next.js 16（basePath `/directory`），客户端在静态 JSON（registry/skills/builder-index/papers，共 ~3MB）上做搜索/筛选/排序，无后端也能全功能。中英切换 `i18n.js`，subject 等筛选用正则词表在客户端推断。
- 嵌入方式：Edu AI Builders 主站把独立部署的 Radar 挂为 Next.js **multi-zone** 子应用——源仓库单一事实源，主站只做挂载与代理，不复制数据。
- 唯一动态 API：`/api/suggestions`（项目推荐表单），可选 Postgres（Neon）存 `learning_goal_private`（学习目标私有，repo 核验后才公开）。migrations/ 里已备好未来把注册表搬进 Postgres + 只读缓存 API 的完整 DDL，但**当前刻意不启用**——静态快照优先，DB 是「明天路径」。
- `site/` 是零依赖静态版（vanilla JS 153 行），作为契约的参考实现。

## 6. 与 innate-feeds 的对照与借鉴清单

两项目都在做「GitHub 教育/开发者的元数据聚合 + 静态化发布」，但取了不同路线：我们 SQLite + Hono 双模式，它 JSONL + 纯静态 + 白名单闸。可借鉴项按性价比排序：

| # | 它的做法 | 我们现状 | 建议动作 |
|---|---|---|---|
| P1 | **ETag 条件请求**（304 不耗限额，缓存持久化） | `gh api` 每次全量拉，无缓存 | trending/starred refresh 走 `gh api --cache` 或自建 ETag 缓存；daily 任务量降一个量级 |
| P1 | **provenance 五件套**（first_seen/last_seen/source/query_id） | 仅 `fetched_at`；#39 刚用 `starred_at` 补了时间维度 | `starred_repos`/`trending_repos` 加 `first_seen` + 来源列；「新 discovered」与「新 starred」才能分开审计 |
| P2 | **发布事务性**（before 快照 + 校验失败不发布 + run-summary） | `data:update:local` 直接写 `frontend/public/data` | export 前快照、校验（现有 import:static 可复用）失败即中止 |
| P2 | **公开快照字段白名单 + 教育信号闸** | 静态导出近乎全量数据 | export-incremental 增加显式 allowlist；高召回注册表与公开快照分层 |
| P2 | **中英查询分开**测覆盖/误报 | topics 查询英文为主 | sync github-topics 查询矩阵中英分列，保留 per-query 统计 |
| P3 | **发现预算制**（查询轮转 + 硬上限 + 游标续转） | topics 固定 top-50/主题 | 若扩外部源，用它的 budget+rotate 模式控 API 量 |
| P3 | 404 不当删除、保留证据 | starred 404 记录如何处理未明确 | refresh 时 404 标 `missing` 保留行而非删除 |
| P3 | 双语界面 + 客户端正则分面 | 已有 i18n 基础 | 无需动 |

反向值得注意的**风险点**（我们不学）：它的搜索矩阵高召回导致 3614 条注册表里大量 `pending` 未水合记录（languages_status pending 占多数），公开快照仍靠正则闸硬滤——如果我们把「发现」扩大到搜索，必须一开始就定好公开闸门，否则噪音会淹没有效数据。

## 7. 一句话总结

Radar 把「**只读公开元数据**」这一件事做到了工程极端：零依赖采集、预算化访问、逐条 provenance、白名单发布、失败不污染、边界写进 schema——对我们最直接的启发不是「再造一个目录」，而是把 §6 的 P1/P2 治理件（ETag 缓存、provenance、事务化导出）移植进现有 sync/export 管线。
