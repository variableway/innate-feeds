/**
 * 教育动画域的数据服务 —— API 模式与静态模式共用同一套语义。
 *
 * 两个数据源都是 backend 的 external source（JSON store）：
 *   - `edu-skills`  skills.sh 领域 SKILL 索引
 *   - `edu-videos`  策展频道的教学视频（只有元数据与链接）
 *
 * API 模式：GET /api/external/{source}
 * 静态模式：GET {base}/data/external/{source}.json
 * 两者返回体结构一致（backend/src/data/export-external.ts 直接落同一个 payload），
 * 所以筛选 / 排序 / 分页统一在客户端做 —— 数据量在百级，比后端再开一套查询接口更划算。
 */

import { EDU_CATEGORIES } from "../../../../shared/edu-categories";
import type {
  EduCategoryCount,
  EduPage,
  EduQuery,
  EduRelevance,
  EduSkill,
  EduVideo,
  ExternalSourcePayload,
  RawExternalItem,
} from "../types/edu";

const API_BASE = "/api";

const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");
const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";

const SKILLS_SOURCE = "edu-skills";
const VIDEOS_SOURCE = "edu-videos";

const DEFAULT_PER_PAGE = 24;

// --- 原始条目 → 视图模型 ---

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function toSkill(item: RawExternalItem): EduSkill {
  const meta = item.metadata ?? {};
  const owner = str(meta.owner);
  const repo = str(meta.repo);
  const skill = str(meta.skill);
  const relevance: EduRelevance =
    meta.relevance === "core" ? "core" : "related";
  return {
    id: item.id,
    title: item.title || skill,
    tagline: item.tagline,
    description: item.description,
    url: item.url,
    repoUrl: item.externalUrl ?? `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    skill,
    relevance,
    installs: num(meta.installs) ?? num(item.metrics.score) ?? 0,
    stars: num(meta.stars) ?? num(item.metrics.stars),
    license:
      meta.license === null || meta.license === undefined
        ? null
        : str(meta.license) || null,
    topics: strArray(meta.topics),
    archived: bool(meta.archived),
    repoUpdatedAt: str(meta.repoUpdatedAt) || null,
    installCommand:
      str(meta.installCommand) ||
      `npx skills add ${owner}/${repo} --skill ${skill}`,
    categories: strArray(item.categories),
    fetchedAt: item.fetchedAt,
    publishedAt: item.publishedAt,
  };
}

function toVideo(item: RawExternalItem): EduVideo {
  const meta = item.metadata ?? {};
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url,
    thumbnail: item.imageUrl,
    channelTitle: str(meta.channelTitle) || str(meta.feedTitle),
    feedId: str(meta.feedId),
    feedTitle: str(meta.feedTitle),
    durationSeconds: num(meta.durationSeconds),
    views: num(meta.views) ?? num(item.metrics.score),
    likes: num(meta.likes) ?? num(item.metrics.comments),
    categories: strArray(item.categories),
    publishedAt: item.publishedAt,
    note: str(meta.note) || null,
    platform: "youtube",
  };
}

// --- 数据加载 ---

/**
 * 取一个外部源的快照。
 *
 * 「源还没采过」是合法状态（例如 CI 缺 YOUTUBE_API_KEY 时 edu-videos 没有快照），
 * 这时返回空快照而不是把 JSON 解析错误抛给页面。
 * 静态模式下缺失的文件会被 SPA fallback 兜底成 index.html（200 + text/html），
 * 所以除了状态码还要看 content-type。
 */
async function fetchPayload(source: string): Promise<ExternalSourcePayload> {
  const url = IS_STATIC
    ? `${STATIC_BASE}/external/${source}.json`
    : `${API_BASE}/external/${source}`;
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    if (res.status === 404) return emptyPayload(source);
    throw new Error(`Failed to load ${source} (${res.status})`);
  }
  if (!contentType.includes("json")) return emptyPayload(source);
  try {
    return (await res.json()) as ExternalSourcePayload;
  } catch {
    return emptyPayload(source);
  }
}

function emptyPayload(source: string): ExternalSourcePayload {
  return {
    source,
    title: source,
    description: "",
    label: "",
    fetchedAt: "",
    count: 0,
    items: [],
  };
}

let skillsPromise: Promise<EduSkill[]> | null = null;
let videosPromise: Promise<EduVideo[]> | null = null;

export function loadEduSkills(): Promise<EduSkill[]> {
  if (!skillsPromise) {
    skillsPromise = fetchPayload(SKILLS_SOURCE)
      .then((payload) => (payload.items ?? []).map(toSkill))
      .catch((err) => {
        // 允许重试：失败后清掉缓存
        skillsPromise = null;
        throw err;
      });
  }
  return skillsPromise;
}

export function loadEduVideos(): Promise<EduVideo[]> {
  if (!videosPromise) {
    videosPromise = fetchPayload(VIDEOS_SOURCE)
      .then((payload) => (payload.items ?? []).map(toVideo))
      .catch((err) => {
        videosPromise = null;
        throw err;
      });
  }
  return videosPromise;
}

/** B14：B 站教学视频（edu-videos-bilibili 源，「源未采过」视为空）。 */
function toBilibiliVideo(item: RawExternalItem): EduVideo {
  const meta = item.metadata ?? {};
  const duration = str(meta.duration);
  const parts = duration.split(":").map((p) => Number.parseInt(p, 10));
  const durationSeconds =
    parts.length > 0 && parts.every((p) => Number.isFinite(p))
      ? parts.reduce((acc, p) => acc * 60 + p, 0)
      : null;
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url,
    thumbnail: item.imageUrl,
    channelTitle: str(meta.up) ? `@${str(meta.up)}` : item.tagline,
    feedId: "edu-videos-bilibili",
    feedTitle: "Edu Videos (bilibili)",
    durationSeconds,
    views: num(item.metrics.score),
    likes: null,
    categories: strArray(item.categories),
    publishedAt: item.publishedAt,
    platform: "bilibili",
    note: str(meta.note) || null,
  };
}

let bilibiliVideosPromise: Promise<EduVideo[]> | null = null;

export function loadEduVideosBilibili(): Promise<EduVideo[]> {
  if (!bilibiliVideosPromise) {
    bilibiliVideosPromise = fetchPayload("edu-videos-bilibili")
      .then((payload) => (payload.items ?? []).map(toBilibiliVideo))
      .catch(() => []);
  }
  return bilibiliVideosPromise;
}

/** 视频池：YouTube + B 站合流（B 站在前，便于看到新源效果）。 */
export async function loadEduVideoPool(): Promise<EduVideo[]> {
  const [bili, yt] = await Promise.all([
    loadEduVideosBilibili(),
    loadEduVideos().catch(() => [] as EduVideo[]),
  ]);
  return [...bili, ...yt];
}

// --- 筛选 / 排序 / 分页 ---

function matchesText(hay: string, needle: string): boolean {
  return hay.toLowerCase().includes(needle.toLowerCase());
}


/** B13 加权分：安装量（缺省回退 stars）× (core ? 5 : 1)。 */
export function eduScore(skill: {
  installs: number;
  stars: number | null;
  relevance: string;
}): number {
  const base = skill.installs > 0 ? skill.installs : (skill.stars ?? 0);
  return base * (skill.relevance === "core" ? 5 : 1);
}

function paginate<T>(items: T[], query: EduQuery): EduPage<T> {
  const perPage = Math.min(100, Math.max(1, query.perPage ?? DEFAULT_PER_PAGE));
  const page = Math.max(1, query.page ?? 1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    total,
    page,
    perPage,
    pageCount,
  };
}

export function filterSkills(
  items: EduSkill[],
  query: EduQuery,
): EduPage<EduSkill> {
  const q = (query.q ?? "").trim();
  let out = items;
  if (q) {
    out = out.filter((s) =>
      matchesText(
        `${s.title} ${s.skill} ${s.owner}/${s.repo} ${s.tagline} ${s.description} ${s.topics.join(" ")}`,
        q,
      ),
    );
  }
  if (query.category) {
    out = out.filter((s) => s.categories.includes(query.category!));
  }
  if (query.relevance) {
    out = out.filter((s) => s.relevance === query.relevance);
  }

  const sort = query.sort ?? "weighted.desc";
  const sorted = [...out].sort((a, b) => {
    switch (sort) {
      case "weighted.desc":
        // B13 打分：安装量（缺省回退 stars）× core 相关度 ×5 —— 与 /ux SKILL 加权同构
        return (
          eduScore(b) - eduScore(a) ||
          b.installs - a.installs ||
          a.title.localeCompare(b.title)
        );
      case "stars.desc":
        return (b.stars ?? -1) - (a.stars ?? -1) || b.installs - a.installs;
      case "updated.desc":
        return (
          (b.repoUpdatedAt ?? "").localeCompare(a.repoUpdatedAt ?? "") ||
          b.installs - a.installs
        );
      case "name.asc":
        return a.title.localeCompare(b.title);
      case "installs.desc":
      default:
        return b.installs - a.installs || a.title.localeCompare(b.title);
    }
  });

  return paginate(sorted, query);
}

export function filterVideos(
  items: EduVideo[],
  query: EduQuery,
): EduPage<EduVideo> {
  const q = (query.q ?? "").trim();
  let out = items;
  if (q) {
    out = out.filter((v) =>
      matchesText(
        `${v.title} ${v.channelTitle} ${v.feedTitle} ${v.description}`,
        q,
      ),
    );
  }
  if (query.category) {
    out = out.filter((v) => v.categories.includes(query.category!));
  }

  const sort = query.sort ?? "published.desc";
  const sorted = [...out].sort((a, b) => {
    switch (sort) {
      case "views.desc":
        return (b.views ?? -1) - (a.views ?? -1);
      case "duration.asc":
        return (
          (a.durationSeconds ?? Number.MAX_SAFE_INTEGER) -
          (b.durationSeconds ?? Number.MAX_SAFE_INTEGER)
        );
      case "title.asc":
        return a.title.localeCompare(b.title);
      case "published.desc":
      default:
        return (
          (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
          a.title.localeCompare(b.title)
        );
    }
  });

  return paginate(sorted, query);
}

// --- 公开 API ---

export async function fetchEduSkills(
  query: EduQuery,
): Promise<EduPage<EduSkill>> {
  return filterSkills(await loadEduSkills(), query);
}

export async function fetchEduVideos(
  query: EduQuery,
): Promise<EduPage<EduVideo>> {
  return filterVideos(await loadEduVideoPool(), query);
}

/** 分类计数：skills 与 videos 合并统计。 */
export async function fetchEduCategoryCounts(): Promise<EduCategoryCount[]> {
  const [skills, videos] = await Promise.all([
    loadEduSkills().catch(() => []),
    loadEduVideos().catch(() => []),
  ]);
  const counts = new Map<string, number>();
  for (const s of skills)
    for (const c of s.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const v of videos)
    for (const c of v.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  return EDU_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    labelZh: category.labelZh,
    emoji: category.emoji,
    count: counts.get(category.id) ?? 0,
  }));
}

/** 概览统计（首页顶部）。 */
export interface EduOverview {
  skills: number;
  coreSkills: number;
  videos: number;
  channels: number;
  /** 数据采集时间（取两个源里较晚的一个） */
  fetchedAt: string | null;
}

export async function fetchEduOverview(): Promise<EduOverview> {
  const [skills, videos] = await Promise.all([
    loadEduSkills().catch(() => []),
    loadEduVideos().catch(() => []),
  ]);
  const fetchedAt = [
    ...skills.map((s) => s.fetchedAt),
    ...videos.map((v) => v.publishedAt ?? ""),
  ].filter(Boolean);
  return {
    skills: skills.length,
    coreSkills: skills.filter((s) => s.relevance === "core").length,
    videos: videos.length,
    channels: new Set(videos.map((v) => v.feedId)).size,
    fetchedAt: fetchedAt.sort().pop() ?? null,
  };
}
