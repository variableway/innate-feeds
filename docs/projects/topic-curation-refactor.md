# 分 Topic 的精选网站重构（AIHot 式编辑管线 brainstorm）

> 状态：**backlog · 待决策** · 调研日期 2026-11-07
> 方向：把 innate-feeds 从「多源 feed 聚合器」重构为「以 Topic 为导航轴心的信息精选网站」，方法论参照 AIHot（LLM 编辑部），数据从现有 14 个源出发，**后台宽进全收，前台严出精选**。

## 0. 结论先行

**接什么**：AIHot 的三件套——热度按独立来源计算（纯规则）、精选席位（前台只出一部分）、日报零模型编排；以及它「收集层与展示层解耦」的架构姿态。落地为 **P0 热度引擎 + P1 Topic Hub 前台**，P0 零 LLM、零新外部依赖、一两天量级。

**不接什么**：AIHot 的全量 LLM 管线（条均 6+ 次调用 × 我们 6000+ 仓库不可接受）、向量事件聚簇（GitHub 仓库的 `fullName` 是天然事件主键，聚簇问题退化为一次 GROUP BY）、Postgres/pg-boss 三进程部署（SQLite + Bun 双模式更贴合）。

**一句话**：我们不需要再造 AIHot——需要把它的「编辑方法论」嫁接到我们已有的元数据管线上，且第一步（P0）连一次模型调用都不需要。

## 1. 现状盘点（实测 2026-11-07，全部来自本机）

### 1.1 数据资产

| 资产 | 量级 | 形态 | 富矿点 |
|---|---|---|---|
| SQLite feeds.db | 6091 仓库（trending 快照 1025 行 + starred 5066） | 12MB WAL | 全源 JOIN 的主键池，`fullName` 全源通吃 |
| digest | 135MB / 90 天（ruanyf 1947 · GitHubDaily 331 · HelloGitHub 723 条 kept） | JSON dump + 全文 | **人肉精选富文本**——最贵的信号，含 `githubRepoFullName` 预解析字段 |
| github-topics | 25 topics × top 50（≈1250 快照） | 12MB JSON | 现有 topic 体系，但 20 个是 AI 同质标签 |
| trendshift | 8.4MB（daily/weekly/monthly/yearly × 16 语言） | JSON 档案 | `rank` / `starsGained` / `socialMentionPlatforms` 现成增速信号 |
| 垂直域 | edu-skills 456 条 + edu-videos + dsh 插件目录 | JSON store | **垂直聚合的已实现模板**（edu-animate domain） |
| 外部小源 | yc 1003 · github-new 50/日 · hackernews 30 · devto 50 · lobsters 25 · a16z 29 · producthunt | JSON store | 现在平等展示；重构后转为后台原料 |

### 1.2 结构现状（问题即机会）

- 导航按**源**组织（trending / starred / digest / feeds 多源页 / edu / dsh），用户视角是「你们家有几个栏目」而不是「我想看什么领域」。
- 10 个外部源平等平铺在 `/feeds`，无人背书、无热度、无分层。
- API/static 双模式的可见性过滤分散在 `db/index.ts` 与 `services/*.ts` 两处——AIHot 的教训：出口越多，越需要唯一的公开读取层。

## 2. 概念转变（三条轴心）

| 维度 | 现状 | 目标 |
|---|---|---|
| 导航轴心 | 按源分栏目 | 按 **Topic** 分频道（一级导航 = 一级 topic） |
| 展示哲学 | 宽进宽出（全列表 + 过滤器） | **宽进严出**：后台全收 14 源，前台只出精选席位 |
| 内容单位 | 仓库卡片列表 | 当日精选卡片 = heat 排名 + 跨源信号徽章（trending #2 · trendshift #1 · GitHubDaily 推荐）+ digest 人肉摘要 |

关键洞察（来自 `docs/research/aihot-analysis.md` §5 + 本轮字段核对）：AIHot 最重的机器（向量召回 → 模型判四种关系 → 写入前复核）是为了解决新闻聚簇；我们的「事件」就是仓库本身，**所有源都带 `fullName`**，聚簇免费。

## 3. 设计轴与选项（每轴给推荐）

### A. Topic 体系与归属 — 推荐 A2 为主、A3 兜底

| 选项 | 内容 | 代价 |
|---|---|---|
| A1 静态配置 | 延续 github-topics 的配置式 topic 清单 | 现状已证明会 AI 同质化（25 个里 20 个 AI 标签） |
| A2 数据驱动（topic-discovery skill） | 从 starred 种子提词频与 lift 分层（业务层 vs 技术层），T1 共现 / T2 Jaccard / T3 GraphQL 三层相关性选一级 topic，并用共现做**自动归属** | 纯 SQL，零成本；一级清单仍需人拍板 |
| A3 LLM 归类 | 每仓一次调用判 topic | 6091 仓一次性 ≈6k 调用 + 增量；只对「无 topic 标签 + 有热度」的仓库兜底才划算 |

落地注意：现有 25 个 topic 是「技术标签堆」，目标一级 topic 应是**用户视角的领域**（如「AI 应用」「Agent 工程」「前端开发」「教育科技」），topic-discovery 的业务层/技术层 lift 分层正是为这个区分设计的（`.claude/skills/topic-discovery/SKILL.md`）。

### B. 精选机制（热度引擎）— 推荐 B1+B3 先行，B2 可选后置

| 选项 | 内容 | 代价 |
|---|---|---|
| B1 纯规则热度（GitHub Hot 方案） | `heat = Σ 独立源权重 × power(0.5, 小时/24)`，48h 窗口，`rule_version` 入数据 | 零 LLM，一两天 |
| B3 人肉精选直采 | digest 的 GitHubDaily / ruanyf / HelloGitHub 条目本身是精选，权重最高（=4） | 已有数据，白捡 |
| B2 LLM 编辑层（AIHot 降维） | 只对每日 heat top 50 跑评分/摘要，反幻觉硬校验（摘要中的名字/数字不在元数据里→整条弃用回退模板），每日熔断上限 | ~50 调用/天，可选开关 |

### C. 前台信息架构 — 推荐 C2 改版 + C1 新页，C3 复用组件

- **C1 Topic Hub 页**：每 topic 一页 = 今日精选 N 条 + 7 日热榜 + topic 内新仓库（github-new 过滤）。
- **C2 首页改版**：从 trending 重定向改为 topic 精选流；现有 trending/starred/digest/feeds 降级为「全部动态」层（后台感的浏览视图，保留但不再是一级门面）。
- **C3 垂直域模板化**：edu-animate 的「垂直聚合域」结构（web-domain + 域内 layout + 卡片组件 + service 双模式客户端）正是 Topic Hub 的通用模板——skill-card→repo-card、video-card→digest-card 即可。dsh 保持独立域不动（它是目录站不是 feed）。

### D. 数据模型 — 推荐 D1 SQLite 主存 + JSON 对外导出

- 新表：`repo_entities`（`fullName` 主键，全源归并的元数据）+ `repo_topic_map`（topic、T1/T2/T3 层级、归属来源）+ `hot_snapshots`（日期 + ruleVersion + 排名）。
- 热度与归属是跨源 JOIN 密集操作，SQLite 6091 行毫无压力且 admin 工作台现成可查；静态模式照旧走 export JSON。
- 拒绝纯 JSON store（D2）：manifest 分片对跨源 JOIN 是灾难。

### E. 前台/后台分离矩阵（本轮重构的核心诉求）

| 层 | 源 | 处置 |
|---|---|---|
| **精选层（前台）** | trending、trendshift、digest、topics、github-new | 进 Topic Hub 与热度榜 |
| **信号层（仅后台）** | yc、a16z、producthunt、hackernews、devto、lobsters、edu-videos、starred | 继续收集；作为热度信号原料与未来 topic 储备，不直接展示 |

实现上不砍任何 collector，只在源配置加 `visibility: "frontend" | "backend"` 标记（对应 AIHot 的「公开读取层 scope」思想：可见性只定义一次）。

### F. 出口（复用而非新建）

日报（零模型编排：一事一条、7 天不重报、同源最多 2 条）→ RSS（综合精选 + 每 topic 一路）→ MCP（GH #35 已立项，直接抄 AIHot `publication/agent.ts` 的服务端围栏拼装）。

## 4. 路线图

| 阶段 | 内容 | 量级 | 前置 |
|---|---|---|---|
| **P0 热度引擎** | `github-hot` collector（B1+B3）+ `repo_entities` 归并表 + `hot_snapshots`（ruleVersion 化）+ `GET /api/hot`；挂 `data:update:local` 尾部 | 1-2 天，零 LLM | 无 |
| **P1 Topic Hub** | topic-discovery 跑一级 topic 候选 → 人拍板 → 自动归属管道（T1/T2/T3）→ Topic Hub 前台 + 首页改版（C1/C2/C3）+ visibility 标记 | 2-4 天 | P0 跑两周验证热度质量；一级清单拍板 |
| **P2 LLM 摘要层（可选）** | top-N 中文摘要 + 反幻觉硬校验 + 每日熔断；提示词版本=内容哈希，已写不重算 | 1-2 天 | 供应商/预算决策 |
| **P3 出口** | 日报编排 → RSS → MCP | 各 0.5-1 天 | P1 |

排序理由：P0 先让数据说话——热度榜跑两周，如果「跨源信号」选出的东西明显好于单一 trending，再投入 P1 前台；P2 严格可选。

## 5. 风险与反面约束

1. **一级 topic 清单的人工拍板是质量上限**——数据只能给候选与归属，领域划分是产品决策。
2. **成本红线**：全量双评分（6091 × 6 调用）永不做；LLM 只出现在 P2 的 top-N。
3. **过度设计红线**：AIHot 的日报空刊/补刊/缺期告警、向量聚簇、pg-boss 均不引入。
4. **垂直域关系**：edu/dsh 是「深挖行业」，topic hub 是「横向导航」，不合并不互相取代。
5. 双模式（API/static）约束贯穿：所有新数据必须可 export 成 JSON 分片，否则 Pages 模式断粮。

## 6. 待决策清单（需人拍板）

1. 一级 topic 清单：先由 topic-discovery 跑 Top 20 候选再挑，还是直接指定 6-8 个种子领域？
2. 现有 25 个 github-topics 配置是保留为二级信号源，还是重组并入新体系？
3. 前台语言：AIHot 全中文写作；我们卡片标题/摘要是否走中文？（影响 P2 的写作提示词）
4. P2 若启动：LLM 供应商与月预算（估 < $10/月量级，按 50 调用/天 × 便宜模型）。
5. `/feeds` 多源页在 Topic Hub 上线后的去留（建议降级保留）。
6. 本方案何时立项：backlog → `docs/project/issues/` + GitHub Issue（走 feeds-sprint）？

## 7. 证据锚点

- AIHot 源码：`references/AIHOT/`（gitignored，不入库），锚定 `92e4a15`（已登记 `registry.yaml`）。
- AIHot 方法论逐节分析：`docs/research/aihot-analysis.md`（§4 双评分、§5 热度、§8 成本治理、§10 对照表）。
- 热度引擎细化方案：本对话 2026-11-06 设计的 GitHub Hot 三阶段方案（P0 即其落地）。
- topic 方法论：`.claude/skills/topic-discovery/SKILL.md`（词频 / lift 分层 / T1-T3）。
- 数据量实测：`bun run stats`（6091 仓）+ `du -sh ~/.innate/*`（2026-11-07，见 §1.1）。
- 许可：AIHot 为 MIT（名字/Logo 除外），提示词参考结构不逐字照抄；无 GPL/AGPL 接触。
