# 前后端数据分离：代码结构调整计划

> 状态更新 2026-11-07：S0（类型收敛）+ S4（源注册表）已随 M0 落地（commit 7fb1ab0）；S1-S3 留独立 track 待排期。

**Status:** backlog —— 方案已成型，**尚未决定是否实施**
**Issue:** [variableway/innate-feeds#36](https://github.com/variableway/innate-feeds/issues/36)（与中文热榜调研同开，便于合并排期）
**调研日期:** 2026-11-01

本文针对本仓「同一份数据契约与加工逻辑在前端与后端各写一遍」的现状，给出结构化改造方案。

> **一句话结论：** 不需要重构架构，需要**收敛到一份真相**。把「类型契约 / 归一化 / 查询参数语义」三件事收进 `shared/`，前端删掉镜像实现；**执行层保留两套**（后端 SQL、前端 JS）——因为静态模式没有服务端，而 SQLite FTS5 + bm25 相对 JS 子串匹配是真实性能优势，硬统一会倒退。

---

## 1. 现状诊断：7 处重复，其中 4 处已经漂移

| # | 重复内容 | 后端 | 前端 | 是否已漂移 |
|---|---|---|---|---|
| 1 | `ExternalFeedItem` 类型 | `backend/src/collector/shared/types.ts:16-43` | `frontend/src/types/external.ts:18-41` | ⚠️ `source` 联合类型：后端 11 个成员、前端 8 个；`metrics` 后端用具名接口、前端内联再抄一遍 |
| 2 | `DshPlugin` 类型 | `backend/src/dsh/catalog.ts:22-40` | `dsh/src/types/plugin.ts:3-22` | ⚠️ 字段集已不一致（`starsUpdatedAt` / `upstreamUrl` 各在一侧） |
| 3 | 插件搜索/排序/分页 | `backend/src/dsh/catalog.ts:312-366` | `dsh/src/services/plugins.ts:41-95` | ⚠️ `category` 后端支持**数组**（`set.has()`），前端只支持**单值**（`===`） |
| 4 | feed 过滤/排序/分页 | `backend/src/db/index.ts:353-430`（SQL + FTS5） | `frontend/src/services/feeds.ts:116-200`（JS 子串匹配） | ⚠️ **搜索语义不同**：后端 `toFtsQuery()` + `bm25` 相关度排序；前端 `includes()` 全文字段匹配 —— **同一个查询词，两端结果集不同** |
| 5 | 外部条目归一化 | collector 内已归一化一次 | `frontend/src/services/external.ts:52-82` **再归一化一遍** | ⚠️ 冗余；掩盖后端契约问题（后端漏字段时前端静默补上） |
| 6 | 外部源清单（id/标题/描述/首页） | `backend/src/data/external-store.ts:24-85` | `frontend/src/types/external.ts:97-195` | ⚠️ 双份维护：加一个源要改 4 个地方 |
| 7 | hidden 项过滤 | `backend/src/data/hidden-store.ts` + server 侧应用 | `frontend/src/services/feeds.ts:22-45` `filterHiddenRepos` / `filterHiddenDigest` | ⚠️ 两端各滤一次，`total` 计数被前端二次修正 |

**代价量化**：第 4 项直接导致**用户可见的行为不一致**（API 模式与静态模式搜同一关键词给出不同结果）；第 1、2、3、6 项是持续的双份维护成本；第 5、7 项是隐藏的复杂度。

---

## 2. 目标分层

现状 `shared/` 只放**常量**（`plugin-categories.ts`、`theme-catalog.ts`、主题 CSS）。建议扩展为**跨层唯一真相**：

```
shared/                          ← 跨层：类型 + 纯函数 + 常量（不放 IO / React / Bun 专有 API）
├── types/                       ← 跨层 DTO 单一来源
│   ├── feeds.ts                 # FeedItem / FeedResponse / FeedStats / FeedFilters
│   ├── external.ts              # ExternalFeedItem / ExternalIndex / ExternalSourcePayload
│   ├── topics.ts                # TopicRepo / TopicSummary / TopicDetail …
│   └── plugins.ts               # DshPlugin
├── normalize/                   ← 纯函数：原始 payload → DTO
│   ├── feeds.ts
│   ├── external.ts
│   ├── topics.ts
│   └── plugins.ts
├── query/                       ← 纯函数：查询参数解析与语义（两端共用）
│   ├── feeds.ts                 # parseFeedQuery → 归一化参数对象
│   └── plugins.ts               # parsePluginQuery → 归一化参数对象
├── sources/                     ← 外部源注册表（数据部分）
│   └── external.ts              # id / title / description / homepage / 分类
└── plugin-categories.ts         # 现有常量（不动）
```

**边界规则（写进 AGENTS.md）：**
1. `shared/` 只允许**纯函数、类型、常量** —— 不允许 `fetch` / `fs` / `bun:sqlite` / `React` / DOM API。
2. `shared/` 不得 import `backend/` `frontend/` `dsh/` 任何文件（防止成环）。
3. `shared/` 的每个文件必须能被 **backend（Bun runtime，`.js` 后缀 import）+ frontend（Bun.build，无后缀 import）+ dsh（Bun.build）** 三处同时消费。

### 已验证的技术前提

| 前提 | 验证结果 |
|---|---|
| Bun.build 能把 `.js` 后缀解析到 `.ts` | ✅ 实测：`import { HELLO } from "../shared/mod.js"` → `Bundled 2 modules`，运行输出 `shared-ok` |
| Bun runtime 能把 `.js` 后缀解析到 `.ts` | ✅ 已在用：`backend/src/dsh/catalog.ts:18` 就是 `from "../../../shared/plugin-categories.js"` |
| `dsh` 包不受影响 | ✅ `dsh/package.json` 为 `"private": true` + `"main": "src/index.ts"`，由 `frontend/src/main.tsx:19` 直接 `import { webDomain as dshDomain } from "../../dsh/src/index"` 打进宿主 bundle，**不单独发布**，故跨包引用 `shared/` 无打包风险 |
| 前端构建已监听 `shared/` | ✅ `frontend/scripts/build.ts` Tailwind 扫描 `frontend/src` + `dsh/src`；`frontend/scripts/dev.ts` 已监控 `../shared` |

> ⚠️ 顺带修正：`AGENTS.md` 写 `dsh/` 是 "self-contained (relative imports only)"，但它实际已跨包引用 `../../../shared/plugin-categories`。**该描述已过时**，本次一并更正。

---

## 3. 迁移步骤（每步独立可验证、可中止）

### S0 — 类型收敛（0.5 天，零运行时风险）

1. 新建 `shared/types/{feeds,external,topics,plugins}.ts`，内容取自**后端**版本（后端是权威：它是产出方）。
2. 前端 `frontend/src/types/*.ts` 与 `dsh/src/types/plugin.ts` 改为 **re-export**：`export type { ExternalFeedItem } from "../../../shared/types/external";`
3. `backend/src/collector/shared/types.ts` 的 `ExternalFeedItem` / `FeedItemMetrics` 改为 re-export 同源。
4. **顺带修掉漂移 #1**：前端 `ExternalSourceId` 删掉，改为从 `shared/types/external.ts` 的 `FeedSource` 派生 —— 两端联合类型从此只有一个来源。

**验收：** `bun run typecheck`（backend/frontend/dsh）全绿；`grep -rn "interface ExternalFeedItem" frontend/src dsh/src backend/src` 只命中 `shared/`。

### S1 — 归一化收敛（1 天）

1. 新建 `shared/normalize/external.ts`：`normalizeExternalItem(raw): ExternalFeedItem`。
2. **后端**在 `backend/src/data/external-store.ts` 写出前调用它 → 落盘 JSON 即终态。
3. **前端** `frontend/src/services/external.ts:52-82` 的 `normalizeItem` 删除，直接信任 payload。
4. 同样处理 feeds / topics / plugins 的 payload 归一化。

**关键收益：** 静态模式不再需要"防御性归一化"，后端契约破损会**立即暴露**而不是被前端静默掩盖。

**风险：** 后端写出的 JSON 字段若与前端预期不符，静态模式会白屏 —— 用 P0 的端到端冒烟兜住（见 §5）。

### S2 — 查询语义收敛（1–2 天）

**只收敛语义，不统一执行。** 这是本方案最关键的设计取舍。

```
shared/query/feeds.ts
  export interface FeedQuery { language?, topics[], search?, sort, order, date?, page, pageSize }
  export function parseFeedQuery(raw: Record<string, unknown>): FeedQuery   // 唯一真源
```

- **后端** `backend/src/app/server.ts` 的 Zod 校验 → 改为调用 `parseFeedQuery`，SQL 仍用 FTS5（`db/index.ts:242` `toFtsQuery` + `:426` bm25）。
- **前端** `frontend/src/services/feeds.ts:116` `applyFilters` → 改为调用同一个 `parseFeedQuery` 拿到参数对象，再用**共享的过滤谓词**（`shared/query/feeds.ts` 导出的 `matchFeedItem(item, query)`）过滤本地数组。

**为什么保留两套执行：**
- 静态模式没有服务端，过滤只能在浏览器做。
- 后端 SQLite FTS5 + bm25 相关度排序对大语料明显优于 JS `includes()`；统一成 JS 是**性能倒退**，统一成 SQL 则静态模式用不了。

**能消除的漂移：** 参数名（`pageSize` vs `perPage`）、默认值（35/100）、排序枚举、topics 的 AND 语义、date 回退规则 —— 这些全部由 `parseFeedQuery` 定义一次。
**不能消除的：** 检索算法本身的差异（全文 vs 子串）。若要彻底一致，得让静态模式也用同一套匹配逻辑 —— 可选做法：后端静态导出时**额外产出 FTS 结果**不可行（组合爆炸），改为**前端改用同款分词/匹配**（成本高）。→ 见 §6 待决策。

### S3 — 消除 hidden 双重过滤（0.5 天）

明确单一归属：**后端负责过滤，前端只负责记录**。

- `backend/src/data/hidden-store.ts` 在所有 list 响应里应用（`server.ts` 已有调用点）。
- 前端 `filterHiddenRepos` / `filterHiddenDigest` 删除，`total` 不再二次修正。
- **例外**：静态模式的 `hidden.json` 由导出时注入（`backend/src/data/hidden-store.ts` 已在导出时应用）→ 前端静态模式同样不需要再滤。

### S4 — 源注册表单一化（0.5 天）

- `shared/sources/external.ts` 存**数据部分**：`id / title / description / homepage / 分类 / 排序权重`。
- 后端 `backend/src/data/external-store.ts` 的 `EXTERNAL_SOURCES` 改为从这里读。
- 前端 `frontend/src/types/external.ts` 的 `EXTERNAL_SOURCE_META` 拆成**纯 UI 覆盖层**（`icon` / `metrics` / `emptyHint`），以 source id 为键 —— UI 关注点不污染 shared。

**收益：** 加一个外部源，从「改 4 处」降到「改 2 处」（shared 数据 + 前端 UI 覆盖）。

### S5 — 类型生成（可选，1 天）

若接受引入 codegen，可让 `shared/types` 由 OpenAPI/JSON Schema 生成。但本仓目前无 codegen 基础设施，**收益不足**，建议不做。

---

## 4. 总工作量与收益

| 步骤 | 工作量 | 消除的漂移 | 风险 |
|---|---|---|---|
| S0 类型收敛 | 0.5 天 | #1 #2 | 极低（编译器保证） |
| S1 归一化收敛 | 1 天 | #5 | 低（需端到端冒烟） |
| S2 查询语义收敛 | 1–2 天 | #3 #4（部分） | 中（涉及核心查询路径） |
| S3 hidden 归属 | 0.5 天 | #7 | 低 |
| S4 源注册表 | 0.5 天 | #6 | 低 |
| **合计** | **3.5–4.5 天** | **7 处** | |

**不属于本方案：** 改 `backend/src/db/` 的 SQL 实现、改 `frontend/src/pages/` 的 UI 组件、把 SQLite 迁走、引入 monorepo 工具链（turbo/nx）。

---

## 5. 验收标准

1. **类型唯一性**：`grep -rn "interface ExternalFeedItem\|interface DshPlugin\|interface FeedItemDTO" backend/src frontend/src dsh/src shared/` → 只命中 `shared/types/`。
2. **归一化唯一性**：`grep -rn "function normalize" frontend/src dsh/src` → 只允许**渲染层**归一化（如把 `null` 显示成 `—`），不允许做 payload 形状修复。
3. **双模式一致性**：同一筛选条件在 API 模式与静态模式下**返回条数与排序一致**（检索算法差异导致的子集差异需在验收单中显式记录）。
4. **回归**：backend 全量测试 + typecheck 三处全绿；新增 `shared/` 纯函数的单测（解析/边界/默认值）。
5. **构建**：静态构建产物与改造前**数据字段完全一致**（用导出 JSON 做 diff）。

---

## 6. 待决策

1. **检索算法是否也要统一？** 彻底统一需让静态模式具备与 FTS5 等价的检索能力（分词 + 相关度），成本显著高于 S2。选项：
   - (a) 只统一参数与过滤语义（推荐）——检索差异显式记录为已知边界；
   - (b) 前端改用轻量分词 + TF-IDF 近似 FTS5 —— 行为接近但非等价；
   - (c) 静态模式改为按需请求服务端 —— 放弃静态模式，否决。
2. **`shared/` 是否升格为独立 package**（`packages/shared`）？当前仓库根 `shared/` 已是既成约定，但 AGENTS.md 标注它 "NOT @innate scope" —— 若未来 `@innate/*` 私有源要复用这些契约，需要重新考虑打包边界。
3. **是否顺带修 `AGENTS.md` 里 dsh "self-contained" 的过时描述**？（建议修，纯事实纠正）
4. **执行顺序**：S0→S4 可一次性做完（约 4 天），还是先只做 S0+S4（纯类型与注册表，1 天，零风险）看效果再决定？

---

## 7. 风险与边界

| 风险 | 等级 | 说明 / 缓解 |
|---|---|---|
| `shared/` 沦为垃圾桶 | 🔴 高 | 靠 §2 的三条边界规则 + code review；出现 IO / React import 即打回 |
| 静态模式因后端字段变更而白屏 | 🟡 中 | S1 必须配端到端冒烟：导出 JSON → 前端加载 → 断言关键字段存在 |
| 后端 SQL 语义改动未同步前端 | 🟡 中 | `parseFeedQuery` 单一来源 + 共享单测；检索算法差异写进验收单 |
| `dsh` 独立发布假设失效 | 🟢 低 | 当前 `private: true` 且不单独发布；若未来独立发布需把 shared 打进包 |
| 改动面大、review 困难 | 🟡 中 | 按 S0–S4 拆 5 个独立 PR，每步可单独回滚 |
| 与 GitHub Pages 双模式构建耦合 | 🟢 低 | `shared/` 纯 TS，Bun.build 已验证 `.js`→`.ts` 解析 |

---

## 8. 附：本次勘查的局限

- 未修改任何代码，纯只读勘查 + 编译验证。
- Bun.build 的 `.js`→`.ts` 解析为**最小样例实测**（2 文件），未在真实 `shared/` 目录上跑完整构建；S0 落地时需跑一次完整 `bun run build` 确认。
- 未量化「漂移 #4 检索差异」对用户的实际影响（需要真实语料做 A/B），该数字缺失。
- 未评估 `shared/` 被打进 `@innate/*` 私有源后，AGPL/MPL 传染的边界（当前本仓无 LICENSE 文件，若未来引入 GPL 代码会首次触发 —— 见 [newsnow-trendradar-integration.md](./newsnow-trendradar-integration.md) §3.3）。
