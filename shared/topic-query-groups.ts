/**
 * Topic 查询分类表（issue #68）—— 跨层单一事实来源。
 *
 * 「分类 → 步骤/子类」两级组织 Topic 资料查询（GH #24 查询面）：
 * - 分类 `edu`：interactive edu / teachable edu / edu animation tutorial 三组；
 * - 分类 `dev`：产品开发五步（brainstorm → 需求分析和编写 → 需求任务分解和
 *   开发任务编写 → 实现计划·Spec·实现任务·验证测试·handoff → UI/UX 设计·
 *   分析·优化·Anti-Slop），步骤序号即流程顺序。
 *
 * 被两处共用：
 * - backend/src/collectors/core/github-topics.ts（默认同步清单去重并入）
 * - frontend/src/types/topics.ts → pages/topics（分类+步骤两级查询 UI）
 *
 * topic 清单为 task-01 实证定稿（见 tasks/sprint-4/research/topic-query-taxonomy.md）。
 * 边界：纯类型/常量，无 IO/React/Bun 专有 API。
 */

export interface TopicQueryGroup {
  /** "edu-interactive" | "edu-teachable" | … | "dev-brainstorm" | … */
  id: string;
  label: string;
  labelZh: string;
  /** "category" = EDU 子类；"step" = 产品开发步骤（渲染时带序号） */
  kind: "category" | "step";
  /** 产品开发步骤序（1-5）；category 组为 undefined */
  step?: number;
  topics: string[];
}

export interface TopicQueryCategory {
  /** "edu" | "dev" */
  id: string;
  label: string;
  labelZh: string;
  groups: TopicQueryGroup[];
}

export const TOPIC_QUERY_CATEGORIES: TopicQueryCategory[] = [
  {
    id: "edu",
    label: "EDU",
    labelZh: "教育",
    groups: [
      {
        id: "edu-interactive",
        label: "Interactive Edu",
        labelZh: "交互式教育",
        kind: "category",
        topics: [
          "interactive-learning",
          "interactive-tutorial",
          "education",
          "edtech",
          "e-learning",
          "quiz",
          "flashcard",
          "teachable-machine",
          "learning-platform",
        ],
      },
      {
        id: "edu-teachable",
        label: "Teachable Edu",
        labelZh: "授课型教育",
        kind: "category",
        topics: [
          "curriculum",
          "course",
          "teaching",
          "courseware",
          "mooc",
          "online-course",
          "syllabus",
          "lesson-plan",
        ],
      },
      {
        id: "edu-animation-tutorial",
        label: "Edu Animation Tutorial",
        labelZh: "教学动画教程",
        kind: "category",
        topics: [
          "explainer-video",
          "explainer",
          "whiteboard-animation",
          "motion-graphics",
          "manim",
          "remotion",
        ],
      },
    ],
  },
  {
    id: "dev",
    label: "Product Dev",
    labelZh: "产品开发",
    groups: [
      {
        id: "dev-brainstorm",
        label: "brainstorm",
        labelZh: "头脑风暴",
        kind: "step",
        step: 1,
        topics: [
          "brainstorm",
          "brainstorming",
          "mind-map",
          "mindmap",
          "ideation",
          "whiteboard",
          "design-thinking",
        ],
      },
      {
        id: "dev-requirements",
        label: "Requirements",
        labelZh: "需求分析和编写",
        kind: "step",
        step: 2,
        topics: [
          "prd",
          "user-stories",
          "requirements-management",
          "use-case",
          "product-management",
        ],
      },
      {
        id: "dev-task-breakdown",
        label: "Task Breakdown",
        labelZh: "需求任务分解和开发任务编写",
        kind: "step",
        step: 3,
        topics: [
          "task-management",
          "project-management",
          "issue-tracking",
          "roadmap",
          "kanban",
          "agile",
          "todo-list",
        ],
      },
      {
        id: "dev-implementation",
        label: "Spec · Build · Verify",
        labelZh: "实现计划·Spec·实现任务·验证测试·handoff",
        kind: "step",
        step: 4,
        topics: [
          "spec-driven-development",
          "tdd",
          "bdd",
          "test-automation",
          "e2e-testing",
          "software-testing",
          "qa",
          "code-review",
          "handoff",
        ],
      },
      {
        id: "dev-uiux",
        label: "UI/UX · Anti-Slop",
        labelZh: "UI/UX 设计·分析·优化·Anti-Slop",
        kind: "step",
        step: 5,
        // 前 14 项与 backend `UX_DESIGN_TOPICS`（sprint-3 B17）同集，DEFAULT_TOPICS
        // 去重后不重复同步；后 5 项为分析/优化类新增（task-01 实证）。
        topics: [
          "ui",
          "ux",
          "design",
          "design-system",
          "ui-components",
          "component-library",
          "figma",
          "accessibility",
          "tailwindcss",
          "shadcn-ui",
          "anti-slop",
          "slop",
          "ai-slop",
          "humanizer",
          "ux-research",
          "user-research",
          "usability",
          "ux-audit",
          "user-experience",
        ],
      },
    ],
  },
];

/** 平铺去重后的全部查询 topic（同步清单并集用）。 */
export const ALL_QUERY_TOPICS: string[] = [
  ...new Set(
    TOPIC_QUERY_CATEGORIES.flatMap((cat) =>
      cat.groups.flatMap((g) => g.topics),
    ),
  ),
];

/** 分组 id → 分组定义 */
export const QUERY_GROUP_BY_ID: Record<string, TopicQueryGroup> =
  Object.fromEntries(
    TOPIC_QUERY_CATEGORIES.flatMap((cat) => cat.groups).map((g) => [g.id, g]),
  );

/** topic → 所属分组 id（一个 topic 只归一组，平铺时取先命中）。 */
export const QUERY_GROUP_OF_TOPIC: Record<string, string> = Object.fromEntries(
  TOPIC_QUERY_CATEGORIES.flatMap((cat) => cat.groups).flatMap((g) =>
    g.topics.map((t) => [t, g.id]),
  ),
);

/**
 * EDU_CATEGORIES 8 类（shared/edu-categories.ts）→ EDU 查询三分组映射（task-03）。
 * 8 类均为「教育动画」域内制作向分类，多数归入 edu-animation-tutorial；
 * classroom（课程/教案向）归 edu-teachable。interactive / teachable 的新 topic
 * （quiz、course 等）超出原 8 类覆盖面，由分组 topics 直接承载，不动 /edu 域。
 */
export const EDU_CATEGORY_QUERY_GROUP: Record<string, string> = {
  "animation-tools": "edu-animation-tutorial",
  explainer: "edu-animation-tutorial",
  "three-d": "edu-animation-tutorial",
  "motion-design": "edu-animation-tutorial",
  storyboard: "edu-animation-tutorial",
  classroom: "edu-teachable",
  "video-production": "edu-animation-tutorial",
  "visual-design": "edu-animation-tutorial",
};

/** edu-categories id → 所属查询分组 id（未映射返回 undefined）。 */
export function eduQueryGroupOf(categoryId: string): string | undefined {
  return EDU_CATEGORY_QUERY_GROUP[categoryId];
}

/** 查询分组 id → 归入该组的 edu-categories id 列表（UI 展示对应用）。 */
export const EDU_CATEGORIES_BY_QUERY_GROUP: Record<string, string[]> =
  Object.entries(EDU_CATEGORY_QUERY_GROUP).reduce<Record<string, string[]>>(
    (acc, [categoryId, groupId]) => {
      (acc[groupId] ??= []).push(categoryId);
      return acc;
    },
    {},
  );
