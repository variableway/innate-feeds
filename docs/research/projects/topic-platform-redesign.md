# Topic 平台重构总案：系统架构 · 模块设计 · 目录结构 · 计划任务

> 状态：**已决策 · M0 已执行（2026-11-07）** · 设计日期 2026-11-07 · 目录见 [projects/](./README.md)
> 前篇：[topic-curation-refactor.md](./topic-curation-refactor.md)（产品方向六条设计轴，本文不再重复）
> 本文 = 工程总案：系统架构分层、模块职责、目录结构终态与迁移映射、AIHot UI 布局参考、里程碑任务分解、docs 治理。
> 执行顺序约束（用户拍板）：**目录重构（M0）先行**，topic 清单拍板与 P0 热度引擎在 M0 之后。

## 0. 结论先行

1. **目录重构核心动作**：新建顶层 `topics/` 收编 `dsh/`、`edu-animate/`（它们本来就是同一件事——不同 topic 的垂直聚合域）；`backend/src/collector/` 按「GitHub 系 / 外部 JSON 源 / 垂直 topic 源」分三组；新增 `backend/src/curation/`（热度+归属）作为 L2 策划层。
2. **UI 参考**：AIHot 用「场景决定布局」——精选流（时间轨）、热点榜（Lead 卡+行榜）、topic 索引（响应式卡片网格）、日报（报纸隐喻）、详情（阅读列+侧栏 RailCard）五套布局各司其职；我们的改版逐场景对号入座，不造第五套。
3. **docs 治理**：66 份文档中，7 月份的 sheet-display Epic（Univer 方案）已被已上线的 CodeMirror admin 超越（9 份待归档关闭）、features/ 与 spec/ 是 MVP 时代活文档需 v2 重写（9 份）、其余保留；`docs/sprints/` 是未登记孤儿目录。
4. **工作量**：M0 目录重构约 1 天（纯机械移动 + 4 处配置同步）；后续 M1-M4 见 §6。

## 1. 系统架构（五层）

```text
┌──────────────────────────────────────────────────────────────┐
│ L4 出口   Web(Topic Hub + 全部动态) · RSS · MCP(GH #35) · 日报 │
├──────────────────────────────────────────────────────────────┤
│ L3 服务   Hono API(/api/hot /api/topics …) · 静态导出(JSON 分片)│
├──────────────────────────────────────────────────────────────┤
│ L2 策划   热度引擎 · topic 归属(T1/T2/T3) · 精选席位 · 归并实体  │   ← 新增 curation/
├──────────────────────────────────────────────────────────────┤
│ L1 采集   GitHub 系(trending/starred/digest/topics/new)        │
│           外部 JSON 源(yc/ph/hn/hf/devto/lobsters/a16z…)       │   ← collector/ 分组
│           垂直 topic 源(awesome-dsh/edu-skills/edu-videos)     │
├──────────────────────────────────────────────────────────────┤
│ L0 基础   SQLite(feeds.db + 3 新表) · ~/.innate JSON stores    │
│           shared/ 跨层契约 · 域插件机制(createWebDomain)        │
└──────────────────────────────────────────────────────────────┘
```

数据流：L1 各 collector 照常写 `~/.innate` 与 SQLite → L2 末序运行（归并实体 → 算热度 → 跑归属）→ L3 出 API 与静态 JSON → L4 前台按 visibility 标记决定展示；**L1 宽进全收，L4 严出精选**。

与 AIHot 的架构同构点（已验证 `references/AIHOT`，锚 `92e4a15`）：我们的 L2≈它的 editorial/events、`visibility`≈它的 `publication/scope.ts` 谓词唯一化、域插件清单≈它的 `site/modules` 三清单机制。差异：它三进程 + pg-boss，我们单进程 CLI 串行 + Bun cron，不引入队列。

## 2. 模块设计

| 层 | 模块 | 职责 | 现状 |
|---|---|---|---|
| L0 | `shared/` | 跨层契约：types/normalize/query/sources + **topic-catalog.ts（新：一级 topic 注册表）** | 常量-only，待数据分离方案 S0-S4 落地 |
| L0 | `backend/src/db/` | schema + 查询；新增 `repo_entities`（fullName 主键归并）、`repo_topic_map`（归属+层级）、`hot_snapshots`（ruleVersion 化排名） | 现有 5 表 |
| L1 | `backend/src/collectors/core/` | github / firecrawl / sync / sync-window / issues-digest / prefetch-readmes | 现 collector/ 平铺 25 文件 |
| L1 | `backend/src/collectors/external/` | yc / a16z / producthunt / hackernews / huggingface / github-new / devto / lobsters / trendshift | 同上 |
| L1 | `backend/src/collectors/vertical/` | awesome-dsh / dsh-catalog / edu-skills / edu-videos | 同上 |
| L2 | `backend/src/curation/`（新） | `heat.ts`（跨源热度公式）、`topic-map.ts`（归属管道）、`entities.ts`（全源归并）、`visibility.ts`（源可见性唯一定义） | 不存在，M1 建 |
| L2 | `backend/src/data/` | JSON stores + export-*（照旧，导出含 hot 数据） | 现有 |
| L3 | `backend/src/app/` | server.ts 加 `GET /api/hot`、`GET /api/topic-hubs/:topic`；cli.ts 加 `sync hot` 子命令 | 现有 |
| L4 | `frontend/`（host） | 壳（sidebar/theme）+「全部动态」页（trending/starred/digest/feeds 降级层）+ 通用组件 | 现有 |
| L4 | `topics/<id>/`（新顶层） | 每个一级 topic 一个域插件包：pages + components + services + `plugin.json`；dsh、edu-animate 为头两个实例 | dsh/、edu-animate/ 平铺顶层 |

**边界规则**（写进 AGENTS.md）：`curation/` 不 import `app/`（由 cli/server 驱动）；`topics/*` 域包不 import `backend/`（只经 services 双模式取数）；`shared/` 维持数据分离方案的三条禁令（无 IO/React/跨向 import）。

## 3. 目录结构终态与迁移映射

```text
innate-feeds/
├── backend/src/
│   ├── app/                  # 不动
│   ├── collectors/           # ← collector/ 改名分组（纯移动 + import 更新）
│   │   ├── core/  external/  vertical/
│   ├── curation/             # 新（M1）
│   ├── data/  db/  dsh/      # 不动（dsh 数据源留在后端侧）
├── topics/                   # 新顶层（M0）
│   ├── dsh/                  # ← dsh/ 整包迁入（package 名不变 @innate/domain-dsh）
│   ├── edu-animate/          # ← edu-animate/ 整包迁入
│   └── _template/            # 新 topic 脚手架（M2：复制即用，含 Hub 页骨架）
├── frontend/                 # host：壳 + 全部动态页 + M2 起 Hub 通用组件
├── shared/                   # 数据分离方案 S0-S4 + topic-catalog.ts
├── docs/  tasks/  registry.yaml
└── package.json              # workspaces: backend, frontend, topics/*
```

**迁移映射表（M0 全部动作）**：

| # | 现状 | 动作 | 需同步的配置（已核实位置） |
|---|---|---|---|
| M0-1 | `dsh/`、`edu-animate/` 顶层平铺 | `git mv` → `topics/dsh`、`topics/edu-animate` | 根 `package.json` workspaces（`"topics/*"`）；`frontend/src/main.tsx:19-20` import 路径；`frontend/scripts/build.ts:32-33` 与 `dev.ts:28-29` 扫描目录（改 `topics/*/src` glob）；AGENTS.md 目录树 |
| M0-2 | `collector/` 25 文件平铺 | 分组 `collectors/{core,external,vertical}/` | backend 内部相对 import + 测试文件随组移动 |
| M0-3 | `shared/` 仅常量 | 落数据分离方案 **S0（类型收敛）+ S4（源注册表）**（各 0.5 天，零风险子集；S1-S3 留独立 track） | 见 frontend-backend-data-separation.md §3 |
| M0-4 | `awesome/`（legacy YAML fallback）、`dev.sh`（legacy） | 删除（fresh catalog 已 local-only，`bun run dev` 已跨平台） | AGENTS.md 两处提及同步删除 |
| M0-5 | docs/sprints/ 孤儿、sheet-display 9 份僵尸 | 按 §7 docs 治理执行 | 各 README 索引 |

**不做**：`backend/src/dsh/` 数据源不随域包走（它是 L1/L2 的后端模块）；`tasks/`、`docs/` 不动；不引入 monorepo 工具链。

## 4. AIHot UI 布局参考（场景 → 布局 → 我们的改版）

AIHot（React Router SSR + Tailwind v4 `@theme` token）的要点：**每个场景一套专属布局，共享的是原语不是页面骨架**——`components/ui/Page.tsx`（ReadingLayout/ArticleLayout/EmptyState）、PillTabs/Sheet/Badge 等原语复用，页面 header 各页自拼；导航单一来源 `shell/nav.ts`（可被模块扩展，≈我们的 navItems capability）。

| AIHot 场景 | 它的布局 | 对应我们的页面 | 采纳方式 |
|---|---|---|---|
| 精选首页 `/` | FeedBar + 筛选芯片 + **HotTopics 热点条**（前 5 名彩色排名行）+ 按日分组时间轨无限流 | 首页改版（M2） | 采纳：日分组时间轨 + 顶部热点条；卡片信息结构照抄——来源行+徽章+标题+摘要+**入选理由**+「另外 N 家也报道了」（我们的等价物 = 跨源信号徽章：trending #2 · trendshift #1 · GitHubDaily 推荐） |
| 热点榜 `/hot` | NO.1 大卡（热度图+走势）→ NO.2/3 中卡 → NO.4-10 行列表 + 页尾「热度怎么算」折叠 | GitHub Hot 页（M1/M2） | **直接照抄信息层级**；「热度怎么算」折叠展示 ruleVersion 公式，天然解决算法透明 |
| Topic 索引 `/topics` | 分组响应式卡片网格（手机 1 列 / lg 3 列 / xl 4 列：品牌标+最新标题+30 天计数） | topic 目录页（M2） | 照抄网格与卡片字段 |
| 单 Topic `/topics/:slug` | 富头部（kicker+logo+定义+三条统计）+ 模块插槽 + 复用 DayList | Topic Hub 页（M2） | 照抄富头部（统计=今日精选数/7 日新增/热度中位）；模块插槽≈我们的域包 parts |
| 日报 `/daily` | **报纸隐喻**：左 sticky 归档栏 + 居中纸面（报头/数据带/头版/双栏 @container 排版，hairline 分隔） | digest 页与 M4 日报出口 | digest 详情保留 master-detail；日报出口采用报纸版面（P3） |
| 条目详情 `/items/:id` | 760px 阅读列 + 2xl 双侧栏（左目录/右操作+评分+标签）+ 阅读进度条 | repo-detail-pane / digest-detail-pane | 我们已是 master-detail；借鉴其右栏 RailCard 分节（README/为什么热/相关 topic） |
| 手机壳 | 顶 PhoneBar + 底 TabBar（精选/热点/日报/我的）+ 下拉刷新 + 44px 触控 | host-shell.tsx | 现为 compact 左栏；M2 改版时评估底部 TabBar（触屏场景） |
| 设计 token | `@theme` 语义色 ink/bg/accent/hot/**rank-***、六档圆角、变体 dark/touch/short | frontend/src/styles.css | 已有主题 token 体系；补 `rank-*` 色阶（榜单排名）与 `hot` 强调色 |

**不采纳**：事件详情页（story.tsx 的分节 sticky 导航+进展时间线）——我们没有「事件」粒度，仓库即事件；搜索繁忙兜底页、changelog 红点等运营细节暂缓。

## 5. docs 治理（66 份全量盘点）

### 5.1 归档/关闭（9 份 + 2 目录，内容被超越或使命完成）

| 文档 | 证据 | 动作 |
|---|---|---|
| `project/issues/sheet-display*.md` ×5（Epic+4 子） | Univer 方案 7 月立项全 open，admin 已用 **CodeMirror** 方案上线（AGENTS.md §Admin workspace）；assignee 涉及 5 个外部 agent 均无产物 | status → cancelled，移 `docs/archive/issues/` |
| `project/tasks/issues/sheet-display*.md` ×5 | 同上，7 月后无更新 | 随 Epic 归档 |
| `project/features/admin-data-sheet.md` | features 表标 planned，实际已按另一方案交付 | 标 superseded → 指向 admin/page.tsx 现状 |
| `docs/sprints/task-39-starred-repo.md` | PR #40 已合并（in_review → merged），`docs/sprints/` 未被任何索引引用 | 归档并删除孤儿目录 |
| `project/issues/ui-layout.md` + task 日志 | done（7 月），其「三栏 UI」结论将被 M2 改版取代 | done 保留 issue，task 日志归档 |

配套代码清理（非 docs，同批）：`awesome/`（legacy YAML fallback，fresh catalog 已 local-only）、`dev.sh`（AGENTS.md 已标注 legacy）。

### 5.2 更新（9 份，活文档已漂移）

| 文档 | 漂移 | 动作时机 |
|---|---|---|
| `project/features/`（README + 7 份） | 7-8 月 MVP 时代：缺 topics / trending-shift / external feeds / edu / dsh 全部新特性 | M2 前台定版后重写为 v2 特性清单（先不动） |
| `project/spec/README.md` + `spec/architecture.md` + `overview.md` | 「问题/MVP 范围/架构」均为 8-13 版，无 curation/topic 概念 | M0 合入后以本方案 §1/§2 重写（v2 spec） |
| `project/index.md`、`docs/index.md` | 缺 backlogs 新篇 | 本方案合入时顺带更新 |
| `AGENTS.md` | 目录树/迁移后全面同步 | M0 必改清单内 |

### 5.3 保留（48 份）

- `research/` ×9：全部近期、registry 锚定，继续作为方法论来源。
- `backlogs/` ×4（含本篇）：待决策池。
- `arch-design/` ×9：**已采纳设计档案性质**，旧文档是历史记录不删；仅 `collector-design.md`（9-20）与 `external-collectors.md` 内容重叠——合并后归档前者；`datasource-frontend-separation.md` 结论已被 plugin-migration 消化，可归档。
- `project/issues/` 8 份 done 垂直任务 + `project/tasks/issues/` 对应日志：sprint 工作流的契约与证据，保留。
- `spec/contracts/` ×3、`spec/conventions.md`：现行有效。

## 6. 计划与任务（里程碑分解）

执行顺序（用户已拍板）：**M0 → M1 →（观察 2 周）→ M2 → M3/M4 按需**。

### M0 目录重构（先行，≈1 天，纯机械）

| 任务 | 内容 | 量级 | 依赖 |
|---|---|---|---|
| T0-1 | `git mv dsh topics/dsh`、`git mv edu-animate topics/edu-animate`；同步 workspaces / main.tsx / build.ts / dev.ts / AGENTS.md 五处 | 0.5 天 | 无 |
| T0-2 | `collector/` → `collectors/{core,external,vertical}/` 分组移动 | 0.5 天 | 无 |
| T0-3 | shared/ S0 类型收敛 + S4 源注册表（数据分离方案子集） | 1 天 | 无 |
| T0-4 | 删 `awesome/`、`dev.sh`；归档 §5.1 的 docs；更新全部索引 | 0.5 天 | T0-1 |
| T0-5 | 验收：`bun run dev` + `build:static` 双模式通过、typecheck 三处绿、CI 绿 | — | 全部 |

### M1 热度引擎（≈2 天，零 LLM）

| 任务 | 内容 | 量级 |
|---|---|---|
| T1-1 | `db/` 三新表 migration（repo_entities / repo_topic_map / hot_snapshots，rule_version 字段） | 0.5 天 |
| T1-2 | `curation/entities.ts` 全源归并（fullName JOIN） | 0.5 天 |
| T1-3 | `curation/heat.ts`（公式+独立源去重+半衰）+ cli `sync hot` | 0.5 天 |
| T1-4 | `GET /api/hot` + 静态导出 + 挂 `data:update:local` 尾部 | 0.5 天 |
| 观察 | 热度榜跑两周，人工评估跨源信号质量 → 决定 M2 | — |

### 观察 | 热度榜跑两周，人工评估跨源信号质量 → 决定 M2

**M1 执行细则（2026-11-07 数据核验后的修订）**：

- **M0 并行性**：M0 只移动 `collector/` 与 `dsh/edu-animate`、改 shared S0/S4，不触碰 `db/schema.sql`、`app/server.ts`、`app/cli.ts`、`data/`；`curation/` 是全新目录 → **T1-1/T1-2/T1-3 可与 M0 并行**，仅 T1-4 的根 `package.json` 挂载（与 M0 的 workspaces 修改并发写）等 M0 合入后做。
- **数据就绪（实测）**：trending 5 天快照（10-16 条/日，SQLite）✅；trendshift daily-all 2170 条（rank/starsGained/periodKey 全）⚠️ **仅存最新一天（每日覆盖）**——hot collector 运行时需顺手归档 `daily/{periodKey}-all.json` 保住 48h 窗口；digest 单文件全量 3030 条、2294 条带 `githubRepoFullName`+`issueCreatedAt` ✅；github-new 带 `metadata.fullName`+`publishedAt` ✅；topics/starred v1 不纳入（弱信号/单人偏差）。
- **表瘦身**：v1 只建 `hot_snapshots` 一张表；`repo_entities` 推迟 M2（热度直接扫 stores，归并表到 topic 归属才必需），`repo_topic_map` 本就属 M2。
- **公式 v1**：`heat = Σ_source w × 0.5^(h/24)`，w = digest 4 / trending 3 / trendshift 3 / github-new 2；`rule_version = hot-v1-48h-halflife24h`；trendshift `starsGained` 作展示字段不进公式；信号明细 `signals[{source,rank,seenAt,weight}]` 全量入快照供前端徽章。
- **落点**：`~/.innate/github-hot/{manifest.json, hot-{date}.json}`（external-store 惯例）→ 导出 `frontend/public/data/hot/` → `GET /api/hot?date=`。总量由 2 天降到 **≈1.5 天**。

### M2 Topic Hub（≈3-4 天）→ [GH #64](https://github.com/variableway/innate-feeds/issues/64)

| 任务 | 内容 | 量级 |
|---|---|---|
| T2-1 | topic-discovery 跑一级 topic 候选 Top 20 → **用户拍板清单** → `shared/topic-catalog.ts` | 0.5 天 |
| T2-2 | `curation/topic-map.ts` 自动归属（T1 共现为主） | 1 天 |
| T2-3 | `topics/_template/` 脚手架 + Hub 通用组件（富头部/信号徽章卡/榜单行，按 §4 映射） | 1 天 |
| T2-4 | 首页改版（精选流+热点条）+ 现有页降级「全部动态」 | 1 天 |
| T2-5 | 源配置 `visibility` 标记 + 索引页（topics 网格） | 0.5 天 |

### M3 LLM 摘要层（可选，1-2 天）：top-N 中文摘要 + 反幻觉硬校验 + 每日熔断；前置供应商/预算决策。
### M4 出口（按需，各 0.5-1 天）：日报（报纸版面）→ RSS → MCP（AIHot 围栏范本，GH #35）。
→ M3/M4 合并为 [GH #65](https://github.com/variableway/innate-feeds/issues/65)

## 7. 验收标准（v2 spec 骨架，重写 spec/ 时接管）

1. M0 后：`topics/<id>` 域包可被宿主经清单发现（`main.tsx` 只 import 清单不改每包）；双模式构建绿。
2. M1 后：`GET /api/hot` 返回 ruleVersion 化排名，`data:update:local` 末序产出当日快照；同仓库跨源信号可见。
3. M2 后：首页为 topic 精选流；每个一级 topic 有 Hub 页（富头部+精选+7 日榜）；仅后台源不在前台出现但数据照常落盘。
4. 全程：静态模式（Pages）不断粮——所有新数据可导出 JSON 分片。

## 8. 待决策（需人拍板）

1. §5.1 的归档清单是否执行（尤其 sheet-display 9 份 cancelled + `awesome/`/`dev.sh` 删除）？
2. M0 的 T0-3 只做 S0+S4 子集、S1-S3 另立 track —— 是否接受？
3. M2 一级 topic：先跑候选再拍板（推荐）还是直接指定？
4. 前台语言（中文标题/摘要与否）——阻塞 M3 提示词设计。
5. 本总案批准后：M0 立即立项走 sprint？M1 顺延还是并行？

> **未完成项已全部立 issue 归档（2026-11-08）**：M2 → [#64](https://github.com/variableway/innate-feeds/issues/64) · M3/M4 → [#65](https://github.com/variableway/innate-feeds/issues/65) · S2/S1 余项 → [#66](https://github.com/variableway/innate-feeds/issues/66) · 文档 v2 与 CI 补源 → [#67](https://github.com/variableway/innate-feeds/issues/67)。M0（已完成）/ M1（[#63](https://github.com/variableway/innate-feeds/issues/63) 已交付关闭）。

## 9. 证据锚点

- AIHot UI：本文 §4 布局地图来自对 `references/AIHOT/apps/web` 的源码探查（2026-11-07，路由/组件/样式 token 均标注原文件路径于探查记录）。
- 迁移配置位置：`package.json:5-10`、`frontend/src/main.tsx:19-23`、`frontend/scripts/build.ts:31-33`、`frontend/scripts/dev.ts:27-29`（实测读取）。
- docs 时间线：`git log -1 --format=%as` 全量 66 份（2026-11-07 实测）。
- sheet-display 超越证据：AGENTS.md「Admin workspace」节（CodeMirror 已上线）vs `issues/sheet-display.md`（Univer，open）。
