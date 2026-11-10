# Topic 查询分类表设计 + topic 种子实证

> task-01 产出物 · 2026-11-10 · 对应 [issue #68](https://github.com/variableway/innate-feeds/issues/68)
> 实证方法：GitHub Search API `topic:{name}` 的 `total_count`（2026-11-10 快照），
> 总量级 + 语义吻合双重判定；近重复 topic 只留较大者。种子量级要求 ≥50（够一个 top-50 快照）。

## 口径（issue #68 语义定稿）

| issue 原文 | 定稿语义 |
|---|---|
| Topic 资料查询 | GH #24 GitHub Topics 数据源查询面（`/api/topics*`、`/topics`） |
| 按分类和步骤分 | 两级：分类（EDU / 产品开发）→ 子类（EDU 3 组）/ 步骤（产品开发 5 步，带序号） |
| interactive edu | 交互式教育：交互式学习工具/平台/自测类 |
| teachable edu | 授课型教育：课程/教案/授课材料类（含 Teachable 一类课程平台生态） |
| edu animation tutorial | 教学动画教程：讲解动画/白板动画/数学动画一类 |
| Anti-Slot | **Anti-Slop**（反 AI 味）——复用 `UX_DESIGN_TOPICS` 的 anti-slop/slop/ai-slop/humanizer |

## 分组定稿（8 组，56 采纳 / 8 淘汰）

id 约定：分类 `edu` / `dev`；子类/步骤断 kebab；步骤序号即流程顺序。

### 分类 EDU（3 组）

**`edu-interactive` 交互式教育**（9）

| topic | repos | 结论 |
|---|---|---|
| interactive-learning | 1152 | 采纳 |
| interactive-tutorial | 101 | 采纳 |
| education | 43155 | 采纳（伞形词，组入口） |
| edtech | 5435 | 采纳（已在 `EDTECH_TOPICS`，不重复同步） |
| e-learning | 1342 | 采纳 |
| quiz | 7022 | 采纳 |
| flashcard | 229 | 采纳 |
| teachable-machine | 287 | 采纳（交互式 ML 教学工具） |
| learning-platform | 950 | 采纳 |

**`edu-teachable` 授课型教育（课程/教案）**（8）

| topic | repos | 结论 |
|---|---|---|
| curriculum | 1564 | 采纳 |
| course | 7160 | 采纳 |
| teaching | 3620 | 采纳 |
| courseware | 658 | 采纳 |
| mooc | 619 | 采纳 |
| online-course | 372 | 采纳 |
| syllabus | 235 | 采纳 |
| lesson-plan | 45 | 采纳（语义核心，量级小注记） |
| ~~teacher~~ | 243 | 淘汰（与 teaching 近重复，留大者） |

**`edu-animation-tutorial` 教学动画教程**（6）

| topic | repos | 结论 |
|---|---|---|
| explainer-video | 282 | 采纳 |
| explainer | 549 | 采纳 |
| whiteboard-animation | 39 | 采纳（语义核心，量级小注记） |
| motion-graphics | 1550 | 采纳 |
| manim | 765 | 采纳（数学动画教程主力） |
| remotion | 1784 | 采纳（程序化动画教程主力） |
| ~~educational-animation~~ | 5 | 淘汰（生态过小） |
| ~~animation-tutorial~~ | 3 | 淘汰（生态过小） |
| ~~tutorial~~ | 24054 | 淘汰（过泛，非动画向） |

### 分类 产品开发（5 步，序号即流程序）

**① `dev-brainstorm` brainstorm**（7）

| topic | repos | 结论 |
|---|---|---|
| brainstorm | 73 | 采纳 |
| brainstorming | 392 | 采纳 |
| mind-map | 370 | 采纳 |
| mindmap | 969 | 采纳（GitHub 两 tag 并存，双收保召回） |
| ideation | 216 | 采纳 |
| whiteboard | 1368 | 采纳 |
| design-thinking | 406 | 采纳 |
| ~~figjam~~ | 64 | 淘汰（工具向，与 figma 生态重叠） |

**② `dev-requirements` 需求分析和编写**（5）

| topic | repos | 结论 |
|---|---|---|
| prd | 858 | 采纳 |
| user-stories | 357 | 采纳 |
| requirements-management | 220 | 采纳 |
| use-case | 111 | 采纳 |
| product-management | 4029 | 采纳 |
| ~~spec-writing~~ | 1 | 淘汰（生态过小） |
| ~~requirement~~ | 24 | 淘汰（与 requirements-management 重复且小） |
| ~~user-story~~ | 67 | 淘汰（与 user-stories 近重复，留大者） |

**③ `dev-task-breakdown` 需求任务分解和开发任务编写**（7）

| topic | repos | 结论 |
|---|---|---|
| task-management | 5127 | 采纳 |
| project-management | 8550 | 采纳 |
| issue-tracking | 251 | 采纳 |
| roadmap | 2471 | 采纳 |
| kanban | 4946 | 采纳 |
| agile | 2466 | 采纳 |
| todo-list | 3160 | 采纳 |
| ~~work-breakdown~~ | 0 | 淘汰（不存在生态） |

**④ `dev-implementation` 实现计划 · Spec · 实现任务 · 验证测试 · handoff**（9）

| topic | repos | 结论 |
|---|---|---|
| spec-driven-development | 2935 | 采纳（Spec 主力） |
| tdd | 9714 | 采纳 |
| bdd | 2971 | 采纳 |
| test-automation | 10352 | 采纳 |
| e2e-testing | 3220 | 采纳 |
| software-testing | 2963 | 采纳 |
| qa | 6336 | 采纳 |
| code-review | 11015 | 采纳（验证环节） |
| handoff | 655 | 采纳（字面 handoff） |

**⑤ `dev-uiux` UI/UX 设计 · 分析 · 优化 · Anti-Slop**（19 = 14 复用 + 5 新增）

| topic | repos | 结论 |
|---|---|---|
| ui / ux / design / design-system / ui-components / component-library / figma / accessibility / tailwindcss / shadcn-ui / anti-slop / slop / ai-slop / humanizer | 已同步 | 复用 `UX_DESIGN_TOPICS`（sprint-3 B17），不重复同步 |
| ux-research | 707 | 采纳（分析） |
| user-research | 388 | 采纳（分析） |
| usability | 509 | 采纳（优化） |
| ux-audit | 97 | 采纳（优化） |
| user-experience | 1078 | 采纳 |
| ~~design-critique~~ | 30 | 淘汰（生态过小） |

## 契约草案（task-02 落 `shared/` 用）

```ts
// shared/topic-query-groups.ts（建议名）
export interface TopicQueryGroup {
  id: string;            // "edu-interactive" | "dev-brainstorm" | …
  label: string;         // "Interactive Edu" / "brainstorm"
  labelZh: string;       // 「交互式教育」/「头脑风暴」
  /** "category" = EDU 子类；"step" = 产品开发步骤（渲染时带序号） */
  kind: "category" | "step";
  /** 产品开发步骤序（1-5）；category 组为 undefined */
  step?: number;
  topics: string[];
}
export interface TopicQueryCategory {
  id: string;            // "edu" | "dev"
  label: string;         // "EDU" / "产品开发"
  groups: TopicQueryGroup[];
}
export const TOPIC_QUERY_CATEGORIES: TopicQueryCategory[];
/** 平铺索引（同步/去重用） */
export const ALL_QUERY_TOPICS: string[]; // = 56 采纳 + UX 14 复用内不含重复
```

去重规则：`edtech` 同时属于 `EDTECH_TOPICS`（GH #24）与 `edu-interactive`——分组里保留，
同步清单取并集去重。

## EDU_CATEGORIES 8 类 → 3 组映射（task-03 预案）

| `shared/edu-categories.ts` 类 | → 查询组 | 备注 |
|---|---|---|
| animation-tools | edu-animation-tutorial | 工具服务于教程产出 |
| explainer | edu-animation-tutorial | |
| three-d | edu-animation-tutorial | |
| motion-design | edu-animation-tutorial | |
| storyboard | edu-animation-tutorial | |
| classroom | edu-teachable | 课程/教案向 |
| video-production | edu-animation-tutorial | |
| visual-design | edu-animation-tutorial | |

注：8 类均为「教育动画」域内制作向分类，故多数映射到 animation-tutorial；
interactive / teachable 两组的新 topic（quiz、course 等）超出原 8 类覆盖面，
由 topic 查询分组直接承载，不动 `/edu` 域（task-03 只落映射与分组数据）。
