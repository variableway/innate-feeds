/**
 * edu-skills —— 教育动画领域的 SKILL 采集器。
 *
 * 数据来源（全部公开、无需鉴权）：
 * 1. skills.sh 的 sitemap（静态 XML，无速率限制）拿全量 skill URL
 * 2. 每个 skill 的详情页里 schema.org JSON-LD 拿 name / description / 安装量
 * 3. GitHub API 补充仓库 stars / license / topics（仅在有 token 时启用，缺失不影响采集）
 *
 * 为什么不直接用 skills.sh 的 /api/v1/*：那个 API 需要 Vercel OIDC 认证
 * （2026-11 实测返回 401 authentication_required），只对部署在 Vercel 上的应用开放。
 *
 * 为什么不一次性抓 20,000 个详情页：先用 sitemap 的 slug 做领域筛选，
 * 只对命中的候选抓详情。领域判定见 shared/edu-categories.ts。
 */

import { execFileSync } from "child_process";
import { fetchHtml, fetchJson } from "./shared/http.js";
import { saveItems } from "./shared/storage.js";
import {
  EDU_DOMAIN_KEYWORDS,
  isEduDomain,
  matchEduCategories,
} from "../../../shared/edu-categories.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

const SITE = "https://www.skills.sh";
const SITEMAPS = ["sitemap-skills-1.xml", "sitemap-skills-2.xml"];

/** 并发抓取上限 —— 对公开站点保持克制。 */
const CONCURRENCY = 6;

/** 单个详情页的超时与重试次数。 */
const DETAIL_TIMEOUT_MS = 20000;
const DETAIL_RETRIES = 2;

/**
 * 采集总时限（毫秒）—— 详情页抓取阶段到达时限即停止开新请求，
 * 用已抓到的部分结果落盘。防止上游站点故障时把 CI 拖到 job 超时。
 */
const DEFAULT_DEADLINE_MS = 10 * 60 * 1000;

interface SkillRef {
  owner: string;
  repo: string;
  skill: string;
  url: string;
}

/** skills.sh 详情页里的 schema.org JSON-LD 片段（只取用得上的字段）。 */
interface SkillLd {
  name?: string;
  description?: string;
  url?: string;
  publisher?: { name?: string; url?: string };
  interactionStatistic?: { userInteractionCount?: number };
}

/** 领域相关度：core = 教育/科普/动画制作链路；related = 泛动效，多为 UI 代码动效。 */
export type EduRelevance = "core" | "related";

const CORE_KEYWORDS = [
  "education",
  "educational",
  "classroom",
  "curriculum",
  "lesson",
  "teacher",
  "teaching",
  "explainer",
  "storyboard",
  "remotion",
  "manim",
  "lottie",
  "whiteboard",
  "scriptwriting",
  "motion-graphics",
  "animated-video",
  "video-script",
  "lesson-plan",
];

function relevanceOf(text: string): EduRelevance {
  const hay = text.toLowerCase();
  return CORE_KEYWORDS.some((kw) => hay.includes(kw)) ? "core" : "related";
}

/** 从 sitemap XML 里抽出全部 <loc>。 */
function parseSitemap(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

/** skills.sh 的 skill URL 形如 https://www.skills.sh/{owner}/{repo}/{skill}。 */
function parseSkillUrl(loc: string): SkillRef | null {
  const m = loc.match(
    /^https?:\/\/(?:www\.)?skills\.sh\/([^/]+)\/([^/]+)\/([^/]+)\/?$/,
  );
  if (!m) return null;
  return { owner: m[1], repo: m[2], skill: m[3], url: loc.replace(/\/$/, "") };
}

/** 从详情页 HTML 里抠出 JSON-LD。 */
function parseJsonLd(html: string): SkillLd | null {
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/;
  const m = html.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as SkillLd;
  } catch {
    return null;
  }
}

/** slug → 可读标题（improve-animations → Improve Animations）。 */
function titleize(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) =>
      w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/** 抓全部 sitemap → 领域候选（slug 级过滤，零额外请求）。 */
export async function collectEduSkillRefs(): Promise<SkillRef[]> {
  const seen = new Set<string>();
  const refs: SkillRef[] = [];

  for (const file of SITEMAPS) {
    const xml = await fetchHtml(`${SITE}/${file}`, { timeout: 60000 });
    for (const loc of parseSitemap(xml)) {
      const ref = parseSkillUrl(loc);
      if (!ref) continue;
      // 领域判定先看 slug + 仓库名 + skill 名
      if (!isEduDomain(`${ref.owner}/${ref.repo}/${ref.skill}`)) continue;
      const key = `${ref.owner}/${ref.repo}/${ref.skill}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
    }
  }

  return refs;
}

/** 抓单个 skill 的详情，失败返回 null（不中断整体采集）。 */
async function fetchSkillDetail(
  ref: SkillRef,
): Promise<{ ref: SkillRef; ld: SkillLd } | null> {
  try {
    const html = await fetchHtml(ref.url, {
      timeout: DETAIL_TIMEOUT_MS,
      retries: DETAIL_RETRIES,
    });
    const ld = parseJsonLd(html);
    if (!ld) return null;
    return { ref, ld };
  } catch (err) {
    console.warn(`[edu-skills] skip ${ref.url}: ${(err as Error).message}`);
    return null;
  }
}

/**
 * 取 GitHub token：环境变量优先，其次 `gh` CLI 已登录的凭据。
 * 与 backend/src/collector/github.ts 的取 token 顺序保持一致；token 绝不落日志。
 */
function resolveGithubToken(): string | null {
  const fromEnv =
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const out = execFileSync("gh", ["auth", "token"], {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** GitHub 仓库补充信息 —— 有 token 才做，没 token 就跳过。 */
interface RepoMeta {
  stars: number;
  license: string | null;
  topics: string[];
  pushedAt: string | null;
  archived: boolean;
}

async function fetchRepoMeta(
  owner: string,
  repo: string,
  token: string | null,
): Promise<RepoMeta | null> {
  if (!token) return null;
  try {
    const data = await fetchJson<{
      stargazers_count?: number;
      pushed_at?: string;
      archived?: boolean;
      license?: { spdx_id?: string | null } | null;
      topics?: string[];
    }>(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      timeout: 30000,
    });
    return {
      stars: data.stargazers_count ?? 0,
      license: data.license?.spdx_id ?? null,
      topics: data.topics ?? [],
      pushedAt: data.pushed_at ?? null,
      archived: data.archived ?? false,
    };
  } catch {
    return null;
  }
}

/** 把 skill 详情映射成统一的 ExternalFeedItem。 */
function toFeedItem(
  detail: { ref: SkillRef; ld: SkillLd },
  repo: RepoMeta | null,
): ExternalFeedItem {
  const { ref, ld } = detail;
  const description = (ld.description ?? "").trim();
  const installs = ld.interactionStatistic?.userInteractionCount ?? 0;
  // JSON-LD 的 name 就是 slug（安装用的名字）；展示用可读形式，slug 保留在 metadata
  const title = titleize(ref.skill || ld.name || "");
  const categoryText = `${ref.skill} ${ref.repo} ${description}`;
  const categories = matchEduCategories(categoryText);
  const relevance = relevanceOf(`${ref.skill} ${ref.repo} ${description}`);
  const repoUrl = `https://github.com/${ref.owner}/${ref.repo}`;

  return {
    id: `edu-skills-${ref.owner}-${ref.repo}-${ref.skill}`,
    source: "edu-skills",
    title,
    tagline:
      description.split(/(?<=[.。!?！？])\s/)[0]?.slice(0, 160) ??
      description.slice(0, 160),
    description,
    url: ref.url,
    externalUrl: repoUrl,
    imageUrl: `https://github.com/${ref.owner}.png`,
    categories,
    metrics: {
      score: installs,
      stars: repo?.stars,
    },
    metadata: {
      owner: ref.owner,
      repo: ref.repo,
      skill: ref.skill,
      relevance,
      installs,
      license: repo?.license ?? null,
      topics: repo?.topics ?? [],
      archived: repo?.archived ?? false,
      repoUpdatedAt: repo?.pushedAt ?? null,
      installCommand: `npx skills add ${ref.owner}/${ref.repo} --skill ${ref.skill}`,
    },
    fetchedAt: new Date().toISOString(),
    publishedAt: repo?.pushedAt ?? null,
  };
}

/** 有限并发的批量抓取。 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export class EduSkillsCollector implements FeedCollector {
  source = "edu-skills" as const;

  /**
   * @param maxRefs    领域候选上限 —— 防止 sitemap 扩容后无节制抓详情页。
   * @param deadlineMs 详情页抓取阶段的总时限；到点即用已抓到的部分结果收工。
   */
  constructor(
    private readonly maxRefs = 600,
    private readonly deadlineMs = DEFAULT_DEADLINE_MS,
  ) {}

  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const token = resolveGithubToken();
    if (!token) {
      console.warn(
        "[edu-skills] 无 GitHub token，跳过仓库元信息补充（stars/license/topics）",
      );
    }
    const refs = (await collectEduSkillRefs()).slice(0, this.maxRefs);
    console.log(`[edu-skills] ${refs.length} 个领域候选，开始抓详情`);

    const deadline = Date.now() + this.deadlineMs;
    let stopped = false;
    const details = await mapWithConcurrency(refs, CONCURRENCY, async (ref) => {
      if (Date.now() > deadline) {
        stopped = true;
        return null;
      }
      return fetchSkillDetail(ref);
    });
    if (stopped) {
      console.warn(
        `[edu-skills] 到达 ${Math.round(this.deadlineMs / 60000)} 分钟时限，剩余候选已跳过`,
      );
    }
    const ok = details.filter(
      (d): d is { ref: SkillRef; ld: SkillLd } => d !== null,
    );

    const items: ExternalFeedItem[] = [];
    for (const detail of ok) {
      const repo = await fetchRepoMeta(
        detail.ref.owner,
        detail.ref.repo,
        token,
      );
      items.push(toFeedItem(detail, repo));
    }

    const core = items.filter(
      (i) => (i.metadata as { relevance?: string }).relevance === "core",
    ).length;
    console.log(
      `[edu-skills] 成功 ${items.length} 条（core ${core} / related ${items.length - core}）`,
    );
    return items;
  }

  async save(): Promise<SaveResult> {
    const label = new Date().toISOString().split("T")[0];
    const items = await this.fetchLatest();
    return saveItems("edu-skills", items, label, `${label}.json`);
  }
}

/** 采集并落盘（固定 latest 标签，供 CLI 直接调用）。 */
export async function syncEduSkills(): Promise<void> {
  const items = await new EduSkillsCollector().fetchLatest();
  if (!items.length) {
    console.warn("[edu-skills] 无数据，跳过写入");
    return;
  }
  const result = saveItems("edu-skills", items, "latest");
  console.log(
    `[edu-skills] 已写入 ${result.outDir} (${result.count} 条, ${result.bytes} bytes)`,
  );
}

export const EDU_SKILL_DOMAIN_KEYWORDS = EDU_DOMAIN_KEYWORDS;
