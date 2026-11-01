/**
 * 教育动画（edu-animate）领域的分类表 —— 跨层单一事实来源。
 *
 * 被三处共用：
 * - backend/src/collector/edu-skills.ts   （按关键词给 skill 归类）
 * - backend/src/collector/edu-videos.ts   （按策展配置给视频归类）
 * - edu-animate/src/**                    （前端分类展示与筛选）
 *
 * 分类用「关键词命中」判定，关键词表按特异性从高到低排列：
 * 先命中 'after-effects' 这类具体词，才轮到 'animation' 这种泛词。
 */

export interface EduCategory {
  id: string;
  label: string;
  labelZh: string;
  emoji: string;
  /** 命中即归入该分类的关键词（小写匹配） */
  keywords: string[];
}

export const EDU_CATEGORIES: EduCategory[] = [
  {
    id: "animation-tools",
    label: "Animation Tooling",
    labelZh: "动画工具链",
    emoji: "🛠️",
    keywords: [
      "remotion",
      "manim",
      "lottie",
      "rive",
      "svg-animation",
      "sprite",
      "tween",
      "keyframe",
      "timeline",
      "storyboard",
      "storyboarder",
      "after-effects",
      "premiere",
      "ffmpeg",
      "canvas-animation",
      "web-animation",
      "animation",
      "animate",
      "motion",
    ],
  },
  {
    id: "explainer",
    label: "Explainer & Educational Video",
    labelZh: "科普解说视频",
    emoji: "🎓",
    keywords: [
      "explainer",
      "educational-video",
      "whiteboard",
      "animated-video",
      "faceless",
      "motion-graphics",
      "educational",
      "explain",
      "teaching-video",
      "video-script",
      "srt",
      "subtitle",
    ],
  },
  {
    id: "three-d",
    label: "3D & Game Animation",
    labelZh: "三维与游戏动画",
    emoji: "🧊",
    keywords: [
      "threejs",
      "three-js",
      "blender",
      "unity",
      "unreal",
      "godot",
      "webgl",
      "webgpu",
      "3d",
      "shader",
      "rigging",
    ],
  },
  {
    id: "motion-design",
    label: "Motion Design",
    labelZh: "动效设计",
    emoji: "🎞️",
    keywords: [
      "framer-motion",
      "gsap",
      "easing",
      "transition",
      "micro-interaction",
      "scroll-animation",
      "motion-design",
    ],
  },
  {
    id: "storyboard",
    label: "Storyboard & Scriptwriting",
    labelZh: "分镜与脚本",
    emoji: "📝",
    keywords: [
      "storyboard",
      "shot-list",
      "scene",
      "narrative",
      "screenplay",
      "scriptwriting",
      "script",
      "storytelling",
    ],
  },
  {
    id: "classroom",
    label: "Classroom & Curriculum",
    labelZh: "课堂教学",
    emoji: "🏫",
    keywords: [
      "classroom",
      "curriculum",
      "lesson-plan",
      "lesson",
      "course",
      "pedagogy",
      "quiz",
      "flashcard",
      "worksheet",
      "handout",
    ],
  },
  {
    id: "video-production",
    label: "Video Production",
    labelZh: "视频制作",
    emoji: "🎥",
    keywords: [
      "video-editing",
      "video-production",
      "youtube",
      "thumbnail",
      "caption",
      "voiceover",
      "dubbing",
      "screen-recording",
      "video",
    ],
  },
  {
    id: "visual-design",
    label: "Visual & Illustration",
    labelZh: "视觉与插画",
    emoji: "🎨",
    keywords: [
      "illustration",
      "infographic",
      "diagram",
      "visualization",
      "drawing",
      "vector",
      "design",
      "brand",
      "style-guide",
    ],
  },
];

/** 分类 id → 分类定义 */
export const EDU_CATEGORY_BY_ID: Record<string, EduCategory> =
  Object.fromEntries(EDU_CATEGORIES.map((c) => [c.id, c]));

/**
 * 按关键词给一段文本归类。
 * 返回去重后的分类 id 数组；命中多个分类时按 EDU_CATEGORIES 的顺序排列
 * （顺序即特异性顺序，更具体的分类排在前面）。
 */
export function matchEduCategories(text: string): string[] {
  const hay = text.toLowerCase();
  const hits: string[] = [];
  for (const category of EDU_CATEGORIES) {
    if (category.keywords.some((kw) => hay.includes(kw))) hits.push(category.id);
  }
  return hits;
}

/**
 * 领域命中判定：用于从全量索引里筛出「教育动画」切面。
 * 关键词刻意保守 —— 宁可漏，不要把泛 animation 的工程类 skill 混进来。
 */
export const EDU_DOMAIN_KEYWORDS = [
  "education",
  "educational",
  "classroom",
  "curriculum",
  "lesson",
  "teacher",
  "teaching",
  "explain",
  "explainer",
  "animation",
  "animated",
  "animator",
  "motion-graphics",
  "storyboard",
  "remotion",
  "manim",
  "lottie",
  "whiteboard",
  "video-script",
  "scriptwriting",
  "motion-design",
];

/** 文本是否落在教育动画领域内。 */
export function isEduDomain(text: string): boolean {
  const hay = text.toLowerCase();
  return EDU_DOMAIN_KEYWORDS.some((kw) => hay.includes(kw));
}
