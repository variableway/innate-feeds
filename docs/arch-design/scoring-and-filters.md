# 打分与过滤器原理（EDU / UI-UX 主题域）

> 2026-11-07 · sprint-3 B12/B13 交付 · 代码事实来源：
> `topics/ux-design/src/pages/page.tsx`、`topics/edu-animate/src/services/edu.ts`
> 演进接管方：M1 热度引擎（[topic-platform-redesign](../research/projects/topic-platform-redesign.md) §6）

## 0. 设计原则

1. **可解释**：公式在 UI 上可见（徽章 title 悬停展示计算式），无黑箱。
2. **静态权重先行**：v1 用「基础指标 × 主题相关度倍数」的简单加权，M1 的
   ruleVersion 热度公式（跨源信号 + 半衰）落地后由后端排名接管，前端退化为展示。
3. **宽进全收、前端排序**：采集侧不打分不删数据，排序发生在展示层——
   同一份快照数据可换任意排序口径重放。
4. **同类同构**：EDU 与 /ux 用同一套打分语言（指标 × 倍数），降低理解成本。

## 1. EDU 打分（edu-skills 域）

```
score = 基础指标 × 倍数
基础指标 = installs（安装量，为 0 时回退 stars）
倍数     = relevance === "core" ? 5 : 1
```

- **core/related 判定不在前端**：来自采集侧（edu-skills collector 的领域关键词
  过滤），前端只消费 `relevance` 字段——相关度是**策展事实**，不是算法输出。
- 默认排序 `weighted.desc`（降序，同分回退安装量 → 名称）；可选纯安装量 /
  stars / 更新时间 / A-Z。
- 展示：卡片「分 N」徽章（hot 色），悬停 title 显示公式。
- 代码：`services/edu.ts` 的 `eduScore()` 与 `weighted.desc` 分支（双模式共用）。

## 2. /ux SKILL 加权（UI/UX Design 主题域）

### 2.1 数据池

并行拉取 10 个 topic 快照（FETCH_TOPICS：ui/ux/design/design-system/
ui-components/component-library/figma/accessibility/tailwindcss/shadcn-ui）
→ 按 `fullName` **去重**（保留 stars 最高实例；若另一快照识别为 SKILL 则
合并该标记）。

### 2.2 SKILL 识别（启发式，两层）

```
isSkill = 名称或描述含 \bskill(s)?\b
       或 repo.topics ∈ SKILL_TOPICS（生态标签集）
```

SKILL_TOPICS = {skills, agent-skills, claude-code, claude, claude-skills,
cursor, cursor-skills, ai-agents, agents, agent, skill}——即 GitHub 上
Agent Skills 生态的惯用标签。

### 2.3 打分与排序

```
score = stars × (isSkill ? 5 : 1)      // SKILL_BOOST = 5
```

- 默认「SKILL 加权」排序（score 降序）→ SKILL 天然置顶；
  可切「纯星数」（stars 降序）——倍数只影响排序，不改展示数据。
- SKILL 卡片 hot 描边 + SKILL 徽章 + 加权分展示。
- **为什么是主题本体**：该域定位是「UI/UX Design 的 Agent SKILL」而非组件
  基础库，加权是把定位编码进排序。

## 3. 过滤链（两者同构，展示层顺序过滤）

```
/ux：  topic tag（药丸或卡片 tag 点击） → 仅SKILL 开关 → 语言 → 关键词
        → 排序（加权/星数）→ 渲染
EDU：  关键词 → 分类（药丸） → 相关度（下拉） → 排序（加权/安装量/…）
        → 分页 → 渲染
```

- 过滤全部**客户端**进行（数据已在内存），切换零请求。
- 卡片 tag 点击 = 设置 activeTag（与药丸共用状态）；外来 tag（不在策展类目
  内）以 `#tag ✕` 徽章呈现，可一键取消。

## 4. 已知边界（如实）

| 边界 | 说明 |
|---|---|
| SKILL 启发式有假阳/假阴 | 名称含 skill 的非 skill 仓库会被加权；用 tag 而非名称的 SKILL 仓库会漏。精确识别需 SKILL.md 存在性检查（未实现） |
| 倍数 ×5 未校准 | 经验值，无数据依据；M1 应由热度公式替代固定倍数 |
| stars 是存量不是势头 | 无时间维度；trendshift 的 starsGained 已有数据但未入打分（M1 的半衰设计解决） |
| 去重保留 stars 最高实例 | 同仓库不同快照日星数差异被丢弃（对主题池无影响，trending 列表的去重是另一处逻辑，保留最新快照） |

## 5. M1 演进（打分的归宿）

打分迁至后端 `curation/heat.ts`：跨源信号（trending / trendshift / digest
推荐）、独立源去重、时间半衰、ruleVersion 化——同分可解释、可回放。前端
加权排序降级为「无后端时的静态模式回退」。

## 6. 验证方法

- EDU：任取卡片，复算 `installs(or stars) × (core?5:1)` 与徽章一致。
- /ux：切「纯星数」再切回「SKILL 加权」，观察 SKILL 卡片位次变化；
  点卡片 tag → 列表收窄 + 出现 `#tag ✕`。
