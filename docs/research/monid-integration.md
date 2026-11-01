# Monid（agent 工具统一网关）结合使用调研

> 调研日期：2026-11-01 · Issue：[#35 调研如何和 monid 结合使用](https://github.com/variableway/innate-feeds/issues/35)
> 源（均于调研当日抓取）：
> - [`qdriven/monid`](https://github.com/qdriven/monid)（[`monid-ai/monid`](https://github.com/monid-ai/monid) 的 fork，connector 层源码，TypeScript + Deno 2.x）
> - [docs.monid.ai](https://docs.monid.ai)（官方文档：Guide / CLI / API Reference）
> - [`monid.ai/SKILL.md`](https://monid.ai/SKILL.md)（面向 agent 的 skill 文件）
> - [`qdriven/awesome-monid`](https://github.com/qdriven/awesome-monid)（社区生态列表：72 项目 / 11 类）
> - [smithery.ai](https://smithery.ai/)（issue 指定的参照物：MCP + Skills 聚合站）
>
> 调研目标：① 弄清 Monid 是什么、怎么接入、怎么计费；② 盘点 innate-feeds 与 Monid 的结合点（消费侧 / 供给侧 / 文档侧）；③ 评估 MCP 化路线（自建 MCP server、Smithery 式注册）；④ 给出带优先级的落地建议。

## 0. 关键结论（先读这里）

1. **Monid = "OpenRouter for agent tools"**：一个 baseURL + 一个 API key，agent 即可调用 **2,000+ 工具、72+ provider**（网页搜索/抓取、公司与人 enrichment、社交平台、评论、行情、视频/图像/语音生成）。核心是三个动词：`discover`（按任务排序整个目录，免费）、`inspect`（查输入 schema 与价格，免费）、`run`（执行，按次/按条计费）。
2. **Monid 不是 MCP，但官方自带 MCP 入口**：本体是 HTTP API（`api.monid.ai/v1/*`），同时官方提供 Streamable HTTP MCP server（`https://mcp.monid.ai/v1`，OAuth 登录，Claude.ai/Claude Code/Codex/OpenCode 即插即用）和 SKILL.md（教 agent 装 CLI 后 `monid discover/inspect/run`）。**MCP 是它的接入面之一，不是它的架构**。
3. **与 innate-feeds 的结合点是三个方向，不是一个**：
   - **方向 A（消费侧）**：把 Monid 当采集基建 —— 替代/补充 Firecrawl（trending 与 PH 抓取的付费 key 依赖）、给 PH zero-items（GH #33）加新通道、**绕过本机 huggingface.co 被墙**（Monid 在远端执行）。
   - **方向 B（供给侧）**：把 innate-feeds 已聚合的数据（trending/starred/topics/plugins 快照）发布成 agent 工具 —— 首选**自建 MCP server**（挂在现有 Hono `/api` 上，成本最低、可同时注册 Smithery 与 awesome-monid），次选给上游提 connector PR。
   - **方向 C（文档侧）**：发布 `/SKILL.md`（monid 同款模式，半天工作量，让任何 agent 学会直接调 innate-feeds API）。
4. **Smithery 参照结论**：它是 MCP server + Agent Skills 的**分发/发现层**（715 个 MCP、独立 Skills 目录、`npx -y smithery setup`、按 MCP 展示调用量）。注意其 **MCP Proxy 与托管身份已于 2026-10-31 关停**（注册与分发仍在）——印证"发布渠道要多元化、不自绑单一聚合站"，与 Monid 的 connector PR、awesome-monid 提交并行不悖。
5. **建议路线**（详见 §4）：P0 先在本机 Claude Code 接入 monid MCP 试用（零代码）；P1 后端加 `MONID_API_KEY` 抓取通道（trending/PH 兜底）；P2 innate-feeds 自建 MCP server + `/SKILL.md`；P3 上游 connector PR 与 dsh 目录 MCP 数据源。

## 1. Monid 是什么

### 1.1 定位

Monid 自我定位 "the data layer for AI agents"：agent 在写爬虫、抓结构化数据、查公司/人/社交数据之前，先 `discover` 一下现成端点，按价格与健康度选一个 `run`。平台负责信任、计费与履约：**每个 connector 用声明式 TS 描述自己的 API 形状与用量模型，加一个 provider 就是一次 PR**，merge 后全平台 agent 都能在 `discover` 里搜到。

| | |
|---|---|
| 上游仓库 | `monid-ai/monid`（MIT；issue 链接的 `qdriven/monid` 是其 fork） |
| 运行时 | Deno 2.x（connector 生态），TypeScript 严格模式 |
| 目录规模 | 2,000+ endpoints / 72+ providers（官方口径，持续增长） |
| 计费 | 按用量（per-call / per-result），无订阅；vendor 报错按 0 结算 |

### 1.2 三个动词与计费

| 动词 | 作用 | 费用 | 说明 |
|---|---|---|---|
| `discover` | 按"任务描述"排序全目录 | **免费** | 每个候选带价格、实时健康度（healthy/stable/degraded/outage）、观测 p50/p95 时延，以及"更便宜/更合适"的替代端点提示 |
| `inspect` | 查单个端点完整契约 | **免费** | 输入 schema（pathParams/queryParams/body）、价格明细、文档 |
| `run` | 执行端点 | **计费** | 异步运行 + `runs` 轮询（CLI `--wait` 阻塞）；响应里带本次实际费用 |

两种计价模型：`PER_CALL`（每次固定，如 Twitter 搜索 $0.003/call）、`PER_RESULT`（按返回条数 + 可选底费，如评论抓取 $0.001/条 + $0.002 底费）。**vendor 非 2xx 响应算数据不算异常，run 正常完成但按 0 结算**（未匹配到公司/人也是 0）——这是它对"爬虫经常空手而归"场景的针对性设计。

健康度用法（SKILL.md 原文）：**用它打破平局，不用它做过滤**——两个端点都合适时选更健康的；不要因为 `unknown` 就跳过。

### 1.3 五种接入方式

| 方式 | 入口 | 适用 |
|---|---|---|
| **MCP** | `https://mcp.monid.ai/v1`（Streamable HTTP，OAuth 登录） | Claude.ai Connectors / Claude Code / Codex / OpenCode 等 MCP 客户端，零安装 |
| **Skill** | `https://monid.ai/SKILL.md` | Claude Code / Cursor 等：agent 读 skill → 装 `@monid-ai/cli` → `monid discover/inspect/run` |
| **CLI** | `npm i -g @monid-ai/cli`（discover/inspect/run/runs/keys） | 人类与 agent 共用；`NO_COLOR=1` 供脚本 |
| **HTTP API** | `https://api.monid.ai/v1/*`，`Authorization: Bearer monid_live_...` | 应用/采集器直接集成（**方向 A 走这条路**） |
| **OAuth 2.0** | 平台代用户调用 | 平台型产品（innate-feeds 暂不需要） |

HTTP API 面：`POST /v1/discover`、`POST /v1/inspect`、`POST /v1/run`、`GET /v1/runs`、`GET /v1/runs/:runId`、`GET /v1/wallet/balance`；列表游标分页（`limit`+`cursor`）；错误码含 **402 余额不足**；每个请求带 `x-request-id` 便于追踪。

### 1.4 connector 层（qdriven/monid 仓库）

```
connectors/<name>/
├── provider.ts                 # defineProvider: name/meta/auth/usage
├── schema/                     # provider 级共享 zod
└── endpoints/<endpoint>/
    ├── endpoint.ts             # defineEndpoint: meta/endpoint/request/input/timeouts
    ├── schema/inputs.ts        # 本端点请求 schema
    ├── endpoint.test.ts        # fixture 回放测试（CI 零网络）
    └── fixtures/*.json         # 录制的响应样本
```

- 声明式契约：provider 声明身份/鉴权注入（如 `presets.auth.header("X-API-Key")`）/用量模型（`UsageModelKind.FREE` 等）；endpoint 声明方法、路径、baseUrl、zod 输入。**`meta.description` 就是产品文案**——`discover` 的排序与 `inspect` 的返回都吃它。
- 提交流程：fork → 写 provider+endpoint → `deno task record` 录 fixture → `deno task check && deno task test`（零网络）→ PR → 邮件 support@monid.ai 人工评审。
- 官方明确**鼓励让 coding agent 写 connector**（AGENT.md 就是给 agent 的brief），并有 `deno task apify:scaffold` 从 Apify actor 输入 schema 自动生成 zod。

### 1.5 SKILL.md 的行为契约（对方向 C 直接可抄）

`monid.ai/SKILL.md` 除命令教学外，最重要的是两条 agent 行为规则，innate-feeds 出 SKILL.md 时应照抄同款语义：

1. **优先级**：① 用户本次任务的明确指示 > ② 用户已有的专用工具（自己的 MCP/API key/CLI/workflow）> ③ Monid 补空隙。"Monid fills the gaps in the user's stack, it doesn't replace it."
2. **Offer, don't override**：两者都能干且用户没表态时，用用户自己的工具；Monid 有真增量时**提出来让用户选**，不许静默切换。原因是 **run 花的是用户的余额**。

## 2. 生态盘点

### 2.1 awesome-monid（社区在怎么用它）

72 个项目、11 个分类（Research & Intel 11、Sales 5、Marketing 3、Commerce 5、Social 5、Generative Media 7、Markets 5、Local 3、**Agent Skills/MCP & Plugins 14**、Framework Integrations 13、Starters 1）。10 个带真实价格标签，量级参考：

- deep-research（Claude skill，跨 X/Reddit/HN/GitHub/Polymarket 扇出检索）：**$0.10–0.20/run**
- JP Gacha Monitor（每周竞品监控 26 个游戏）：**$0.04/run**
- Ratina（Amazon 评论失败模式分析）：**$0.018/次调查**
- 吃啥六爻（大众点评搜索）：**$0.015/搜索**

即：**一次"抓一页结构化数据"的 run 成本普遍在 $0.0x 量级**，每天几十次 sync 的场景月成本在个位数美元级——方向 A 的成本是可预算的。

与本调研直接相关的生态位：

- **Monid MCP**（ashafizullah/monid-mcp）：把 Monid 搜索/抓取暴露成 MCP 工具，$0/call；
- **grantry**：权限网关——存一次 Monid key，把 discover/inspect/run 作为**带审计的 MCP 工具**授予多个 agent（多 agent 团队的 key 管理思路）；
- **monid-client**（FeiyouG）：社区最早的 CLI/SDK 封装；
- **Oto Connectors**：Python 类型化客户端（discover/inspect/run/runs 轮询）；
- **Web Search Plus MCP / pi-web-search / Hermes 系列**：把 Monid 作为多 provider 搜索中的一路兜底；
- **ScopeBlind Skills**：带预算上限的 skill 封装（防计费失控的现成参考）。

### 2.2 smithery.ai（issue 指定参照物）

Smithery 是 **MCP server + Agent Skills 的聚合注册表**：首页 715 个 MCP，独立 Skills 栏；每个条目展示调用量（Agent News 43.39k、OneSignal 22.49k、Exa 9.18k、Context7 5.56k uses）与 "Add to toolbox"；发布走 "Publish MCP Server" 文档；`npx -y smithery setup` 让 agent 自助安装；Smithery Connect（开源 agent.pw vault）统一管理凭据。

**⚠️ 时效要点**：其 **MCP Proxy 与托管身份（managed identity）已于 2026-10-31 关停**（首页公告"See what's changing"）——即 Smithery 正从"托管代理"退回"注册表/分发层"。对本调研的启示：① 注册 Smithery 仍有分发价值（调用量即曝光）；② 但**不能把 MCP 服务托付给单一聚合站**，自有域名 + 多渠道（Smithery + awesome-monid + monid connector）并行才是稳态。

### 2.3 Monid 与 Smithery 的关系

两者解决的是同一条链路的两段：**Monid 是执行/计费聚合层**（统一 HTTP/MCP 面 + 钱包），**Smithery 是服务发现/分发层**（目录 + 安装量 + 凭据托管）。innate-feeds 若要"被 agent 用到"，两边都是发布渠道；若要"用别人的工具"，只看 Monid。

## 3. innate-feeds 结合点分析

### 3.1 现状与痛点（结合点由此而来）

| 现状 | 出处 | Monid 能给的 |
|---|---|---|
| Trending 抓取依赖 Firecrawl（key 依赖；结果 < 15 条时回退 gh scrape） | `backend/src/collector/sync.ts`（`MIN_FIRECRAWL_REPOS = 15`） | 抓取端点池（浏览器渲染、JSON 抽取），一个 key 多家供应商，健康度排序 |
| PH 采集 Firecrawl 失败回退裸 HTML，且出现过 **0 条无报错** | `backend/src/collector/producthunt.ts`；[GH #33](https://github.com/variableway/innate-feeds/issues/33)（`docs/project/issues/producthunt-zero-items.md`） | 换供应商不改解析层的第二兜底；按 0 结算的失败语义让"空结果"可观测 |
| **本机 huggingface.co 完全不可达**，`sync:huggingface` 必超时 | 本机环境事实（2026-10-31 确认，CI 正常） | Monid 远端执行，出口不受本机网络限制 |
| 8 个 JSON 源全是自写解析器，供应商单点 | `backend/src/collector/*`（`FeedCollector` 契约） | 传输层换道不动契约（见 3.2） |
| 数据已聚合、有快照/去重/隐藏机制，但只有 HTTP UI 消费 | `/api/feeds`、`/api/topics`、`/api/plugins` | 供给侧发布成 agent 工具（见 3.3） |

### 3.2 方向 A：Monid 作为采集通道（消费侧）

**定位**：不是新增一个 `FeedSource`，而是给现有 collector 加一条**可切换的传输通道**——与 Firecrawl→gh-scrape 兜底链同级。

- **落点**：`backend/src/collector/shared/monid.ts`（新）：封装 `discover(query)` / `run(endpointId, input)` / `wallet()` 三个薄函数（`fetchJson` 走 `Authorization: Bearer ${MONID_API_KEY}`，env 优先级 `MONID_API_KEY`，未设置时整体禁用、日志一行，保持零依赖可用）。
- **接入顺序建议**（按痛点强度）：
  1. **HF 兜底**：`huggingface.ts` 直连超时后，`discover "huggingface trending models"` 选健康端点重试一次（本机收益立竿见影）；
  2. **PH 兜底**：Firecrawl 与 fetchHtml 都失败/为空后走 Monid 抓取（针对 #33 的"无报错 0 条"，run 的结算语义保证失败可见）；
  3. **trending 三兜底**：Firecrawl → gh scrape → Monid（优先级最低，因为 gh scrape 已很稳）。
- **成本护栏**（照抄生态现成做法）：每日 sync 限额（如单源 ≤ 5 次 run）；run 响应记录实际费用进 manifest（`storage.ts` 的 `SaveResult` 可加 `costUSD?`）；`monid balance`/`GET /v1/wallet/balance` 进 `data:update:local` 的尾部报表。参照 SKILL.md 的立场：**用户已有专用工具（gh CLI、Firecrawl key）优先，Monid 只补空隙**。
- **风险**：外部依赖 +1；端点结果 schema 由 `inspect` 动态给出，映射代码要按端点写死并留 fixture（沿用本仓 collector 的测试习惯）；付费服务需在 README 标注 opt-in。

### 3.3 方向 B：innate-feeds 发布为 agent 工具（供给侧）

innate-feeds 对 agent 的独特价值：**GitHub 生态趋势的"已聚合、已去重、带历史快照"视图**（trending/starred/topics/dsh 目录），比 agent 现抓 GitHub API 省事且结果稳定。两条发布路径：

**B1 自建 MCP server（推荐先做）**

- 落点：Hono 挂 `/api/mcp`（Streamable HTTP），用官方 `@modelcontextprotocol/sdk` 的 `StreamableHTTPServerTransport` 桥接 Hono 的 fetch handler；工具直接映射现有 GET 端点，零新数据逻辑：
  - `search_feeds`（→ `/api/feeds`：type/language/topics/search/sort/date 全参数）
  - `get_feed_stats` / `list_languages` / `list_dates`（→ 三个聚合端点）
  - `list_topics` / `get_topic`（→ `/api/topics`、`/api/topics/:topic`）
  - `search_plugins` / `get_plugin`（→ `/api/plugins`、`/api/plugins/:slug`）
- 发布渠道：Smithery（Publish MCP Server 文档）+ awesome-monid 提 PR（`data/projects.yaml` 一条记录）——正好复刻 issue 里 smithery.ai 的模式。
- **双模式限制**：静态模式（GitHub Pages）没有后端 → MCP 仅 API 模式（`bun run start` / 自托管）可用。文档需写明；若要静态模式也"可被 agent 用"，靠方向 C 的 SKILL.md + `/data/*.json` 只读契约即可覆盖大半。

**B2 上游 Monid connector（后置）**

- 把上面的工具面写成 `connectors/innate-feeds/`（provider `usage: FREE` 或 `PER_CALL 0`，endpoint 声明输入 zod），PR 到 `monid-ai/monid` + 邮件评审。
- 前提：innate-feeds 有一个公网稳定的 API 部署（connector 的 `baseUrl` 指向它）；本地/自托管场景不适合。
- 成本收益比不如 B1（B1 一个下午、自有渠道；B2 要过上游人工评审且引流有限），但 B1 上线有真实调用量后再提 PR 顺理成章。
- 附带收益：官方鼓励 agent 写 connector（AGENT.md），可作为一次"让 coding agent 干活"的练手——与本仓 DSH 目录（agent 工具目录站）的问题域天然相邻，见 P3。

**B1/B2 共同注意**：MCP/connector 都是只读查询，不暴露 `/api/feeds/sync`、admin 等写操作端点（本仓 API 无鉴权，公网部署时 MCP 面也要加同样的访问控制）。

### 3.4 方向 C：SKILL.md + agent 文档（最小成本）

- 在 Hono 加 `GET /SKILL.md`（静态模式下由构建脚本抄进 `dist/`）：内容即"innate-feeds 是什么、有哪些 API、参数怎么传、静态模式读 `/data/*.json` 的只读契约"，并写明适用场景与不适用场景（照 §1.5 monid 的写法，`meta.description` 式的"说清自己不干什么"）。
- 与 `docs/project/spec/contracts/` 的 API 契约同源维护，避免两份文档漂移。
- Claude Code / Cursor / 任何支持 Agent Skills 的客户端可以直接消费；这也是 smithery Skills 目录的收录形态。

## 4. 建议路线图

| 优先级 | 动作 | 工作量 | 收益 | 风险 |
|---|---|---|---|---|
| **P0 试用** | 本机 Claude Code 接入 `https://mcp.monid.ai/v1`（OAuth），日常调研任务用 `discover/inspect`（免费）体验目录质量 | 10 分钟 | 直接建立体感，为 P1 选端点 | 无（discover/inspect 免费；run 才花钱） |
| **P1 采集通道** | `shared/monid.ts` + HF/PH 兜底 + 钱包余额报表（§3.2） | 1–2 天 | 消 Firecrawl 单点、治 #33 一类静默失败、绕 HF 被墙 | 付费 opt-in；需限额与费用记录 |
| **P2 供给侧** | `/api/mcp` MCP server（B1）+ `/SKILL.md`（C）+ Smithery/awesome-monid 注册 | 2–3 天 | innate-feeds 进入 agent 工具生态，被 Smithery 型客户端直接调用 | 只读面裁剪；API 模式限定 |
| **P3 扩展** | 上游 connector PR（B2）；dsh 目录增加 "MCP servers" 数据源（awesome-monid MCP 类 / Smithery 目录快照，复用 GH #30 流水线） | 各 1–3 天 | 双渠道分发；dsh 从"插件目录"扩成"agent 工具目录" | 上游评审周期；数据政策（拉取数据不提交，只提交代码） |

P1 与 P2 相互独立，可并行立项；P0 建议立刻做（零成本，且 P1 选哪些端点应基于试用结论）。

## 5. 风险与开放问题

1. **计费失控**：所有 run 花真实余额。P1 必须带护栏（限额 + 费用进 manifest + 余额报表）；本地 Orca 自动化（`data:update:local`）接入前先确认默认关闭。
2. **平台年龄**：Monid 2026 年上线、目录与计费模型仍在快速迭代（SKILL.md 版本 0.1.8，要求 CLI 与 skill 严格同版）；awesome-monid 里项目多为黑客松产物。**接入面保持薄**（一个 `shared/monid.ts` 可整体删除），不深度耦合。
3. **Smithery 变数**：proxy/托管身份刚于 2026-10-31 关停，商业模式调整中——注册可以，托管不必。
4. **静态模式边界**：GitHub Pages 模式下本调研的供给侧只有 SKILL.md + `/data/*.json` 可用；MCP server 需要 API 模式部署（自托管或 VPS），与现有"双模式并用"架构不冲突但要在文档中标清。
5. **数据政策**：方向 A 引入的外部数据仍遵守"数据不提交、只提交代码"；dsh 若收录 MCP 目录快照，同样只提交构建产物不提交采集数据（与 awesome-dsh 现状一致）。
6. **开放问题**：① Monid 目录里是否有稳定的 HF 趋势端点（P0 试用时确认）；② awesome-monid 收录标准（CONTRIBUTING.md）对 hosted 服务的门槛；③ monid MCP 的 OAuth 在 Claude Code 国内部署下的可用性（本机网络限制需实测）。
