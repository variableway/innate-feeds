import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import type { TopicRepo, TopicResponse } from "../../../../shared/types/topics";

/**
 * UI/UX Design 主题 Hub v1.5（sprint-3 B12）。
 * 本体是 UI/UX Design 的 **AI SKILL**（ui-ux-pro-max / taste-skill / hallmark 一类），
 * 不是组件基础库——SKILL 权重放大（×5），默认按加权分排序，可切纯星数。
 * 数据：合并 10 个 topic 快照（/api/topics/:topic 或 /data/topics/:topic.json），
 * 去重后客户端加权排序；M1 热度引擎落地后由后端 ruleVersion 排名接管。
 */

/** 数据池：合并这些 topic 快照（含技术栈源，丰富候选；不进页面类目）。 */
const FETCH_TOPICS = [
  "design-system",
  "ui",
  "ux",
  "design",
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
];

/** 页面类目：策展的业务层 topic（技术栈类不在此列）。
 * topics 支持一类多源：仓库命中任一即属该类目。 */
export const CATEGORY_TOPICS: { id: string; label: string; topics: string[] }[] = [
  { id: "design-system", label: "设计系统", topics: ["design-system"] },
  { id: "ui", label: "UI", topics: ["ui"] },
  { id: "ux", label: "UX", topics: ["ux"] },
  { id: "design", label: "Design", topics: ["design"] },
  { id: "ui-components", label: "组件库", topics: ["ui-components"] },
  { id: "component-library", label: "组件框架", topics: ["component-library"] },
  { id: "figma", label: "Figma", topics: ["figma"] },
  { id: "accessibility", label: "无障碍", topics: ["accessibility"] },
  { id: "anti-slop", label: "反 AI 味", topics: ["anti-slop", "slop", "ai-slop"] },
  { id: "humanizer", label: "Humanizer", topics: ["humanizer"] },
];

/** SKILL 特征 topic（Agent Skills 生态标签） */
const SKILL_TOPICS = new Set([
  "skills",
  "agent-skills",
  "claude-code",
  "claude",
  "claude-skills",
  "cursor",
  "cursor-skills",
  "ai-agents",
  "agents",
  "agent",
  "skill",
]);

const SKILL_BOOST = 5;

interface MergedRepo {
  repo: TopicRepo;
  isSkill: boolean;
  score: number;
}

const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";

async function fetchTopic(topic: string): Promise<TopicResponse> {
  const url = IS_STATIC ? `/data/topics/${topic}.json` : `/api/topics/${topic}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load topic ${topic}: ${res.status}`);
  return (await res.json()) as TopicResponse;
}

function detectSkill(repo: TopicRepo): boolean {
  if (/\bskill(s)?\b/i.test(repo.fullName) || /\bskill(s)?\b/i.test(repo.description ?? ""))
    return true;
  return (repo.topics ?? []).some((t) => SKILL_TOPICS.has(t));
}

function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function UxDesignPage() {
  const [mode, setMode] = useState<"skill" | "stars">("skill");
  const search = useSearch({ strict: false }) as { tag?: string };
  const [activeTag, setActiveTag] = useState<string | null>(search.tag ?? null);
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("");
  const [skillOnly, setSkillOnly] = useState(false);
  const [merged, setMerged] = useState<MergedRepo[] | null>(null);
  const [skillCount, setSkillCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(FETCH_TOPICS.map((t) => fetchTopic(t)))
      .then((responses) => {
        if (cancelled) return;
        const byName = new Map<string, MergedRepo>();
        for (const res of responses) {
          for (const repo of res.items) {
            const isSkill = detectSkill(repo);
            const existing = byName.get(repo.fullName);
            if (!existing || repo.stars > existing.repo.stars) {
              byName.set(repo.fullName, {
                repo,
                isSkill,
                score: repo.stars * (isSkill ? SKILL_BOOST : 1),
              });
            } else if (isSkill && !existing.isSkill) {
              existing.isSkill = true;
              existing.score = existing.repo.stars * SKILL_BOOST;
            }
          }
        }
        const list = [...byName.values()];
        setMerged(list);
        setSkillCount(list.filter((m) => m.isSkill).length);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const languages = useMemo(() => {
    if (!merged) return [] as string[];
    return [...new Set(merged.map((m) => m.repo.language).filter((x): x is string => Boolean(x)))].sort();
  }, [merged]);

  const visible = useMemo(() => {
    if (!merged) return [];
    const q = query.trim().toLowerCase();
    const filtered = merged.filter((m) => {
      if (activeTag) {
        const cat = CATEGORY_TOPICS.find((c) => c.id === activeTag);
        const tags = cat ? cat.topics : [activeTag];
        if (!(m.repo.topics ?? []).some((t) => tags.includes(t))) return false;
      }
      if (skillOnly && !m.isSkill) return false;
      if (lang && m.repo.language !== lang) return false;
      if (q) {
        const hay = `${m.repo.fullName} ${m.repo.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) =>
      mode === "skill" ? b.score - a.score : b.repo.stars - a.repo.stars,
    );
  }, [merged, mode, activeTag, skillOnly, lang, query]);

  return (
    <div className="mx-auto w-full max-w-[var(--page-max-reading)] px-4 py-8 sm:px-6 lg:px-8">
      {/* AIHot 富头部 */}
      <header className="mb-8">
        <p className="text-[13px] text-hot">主题 · Topic</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">UI/UX Design SKILL</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
          UI/UX 设计的 Agent SKILL 优先（加权 ×{SKILL_BOOST}），基础库靠后——
          合并 {FETCH_TOPICS.length} 个 GitHub Topic 快照去重排序，M1 热度引擎落地后由
          ruleVersion 排名接管。
        </p>
        {merged ? (
          <p className="mt-3 flex flex-wrap gap-4 text-[13px] tabular-nums text-ink-4">
            <span>
              去重后 <span className="text-ink-2">{merged.length}</span> 仓库
            </span>
            <span>
              其中 SKILL <span className="text-hot">{skillCount}</span>
            </span>
          </p>
        ) : null}
      </header>

      {/* 过滤器（B13：对齐 EDU 页的筛选形态） */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索 SKILL、仓库或描述"
          aria-label="搜索"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm text-ink-2 sm:max-w-xs"
        />
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label="语言"
          className="h-9 rounded-md border bg-background px-2 text-sm text-ink-3"
        >
          <option value="">全部语言</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSkillOnly((v) => !v)}
          aria-pressed={skillOnly}
          className={
            skillOnly
              ? "h-9 rounded-full border border-transparent bg-hot px-3 text-[13px] leading-9 text-background"
              : "h-9 rounded-full border border-border px-3 text-[13px] leading-9 text-ink-3 transition-colors hover:border-ink-4/40 hover:text-ink"
          }
        >
          仅 SKILL
        </button>
      </div>

      {/* 排序 + 主题筛选 */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="排序">
          {(
            [
              { value: "skill", label: `SKILL 加权（×${SKILL_BOOST}）` },
              { value: "stars", label: "纯星数" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={mode === opt.value}
              onClick={() => setMode(opt.value)}
              className={
                mode === opt.value
                  ? "rounded-full border border-transparent bg-ink px-3 py-1 text-[13px] leading-5 text-background"
                  : "rounded-full border border-border px-3 py-1 text-[13px] leading-5 text-ink-3 transition-colors hover:border-ink-4/40 hover:text-ink"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Topic 筛选">
          <button
            type="button"
            role="tab"
            aria-selected={activeTag === null}
            onClick={() => setActiveTag(null)}
            className={
              activeTag === null
                ? "rounded-full border border-transparent bg-hot px-3 py-0.5 text-[12px] leading-5 text-background"
                : "rounded-full border border-border px-3 py-0.5 text-[12px] leading-5 text-ink-4 transition-colors hover:border-ink-4/40 hover:text-ink-2"
            }
          >
            全部
          </button>
          {CATEGORY_TOPICS.map((t) => {
            const active = t.id === activeTag;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTag(active ? null : t.id)}
                className={
                  active
                    ? "rounded-full border border-transparent bg-hot px-3 py-0.5 text-[12px] leading-5 text-background"
                    : "rounded-full border border-border px-3 py-0.5 text-[12px] leading-5 text-ink-4 transition-colors hover:border-ink-4/40 hover:text-ink-2"
                }
              >
                {t.label}
              </button>
            );
          })}
          {activeTag && !CATEGORY_TOPICS.some((c) => c.id === activeTag) ? (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              title="点击取消该 tag 筛选（来自卡片）"
              className="rounded-full border border-transparent bg-ink px-3 py-0.5 text-[12px] leading-5 text-background"
            >
              #{activeTag} ✕
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="py-20 text-center text-sm text-ink-4">
          合并 {FETCH_TOPICS.length} 个 topic 快照中…
        </p>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <p className="text-sm font-medium text-ink-2">{error}</p>
          <p className="text-[13px] text-ink-4">
            先采集：<code>cd backend && bun src/app/cli.ts sync job github-topics</code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(({ repo, isSkill, score }) => (
            <a
              key={repo.id}
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className={
                isSkill
                  ? "flex h-full flex-col gap-2 rounded-card border border-hot/40 bg-hot-soft p-4 transition-colors hover:border-hot/70"
                  : "flex h-full flex-col gap-2 rounded-card border bg-card p-4 transition-colors hover:border-ink-4/40"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-sm font-semibold text-ink">
                  {repo.fullName}
                </h3>
                {isSkill ? (
                  <span className="shrink-0 rounded-mark bg-hot px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-background">
                    SKILL
                  </span>
                ) : null}
              </div>
              {repo.description ? (
                <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-3">
                  {repo.description}
                </p>
              ) : null}
              {(repo.topics ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(repo.topics ?? []).slice(0, 4).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTag((cur) => (cur === t ? null : t));
                      }}
                      className={
                        t === activeTag
                          ? "rounded-mark border border-transparent bg-hot px-1.5 py-0.5 text-[11px] text-background"
                          : "rounded-mark border border-border px-1.5 py-0.5 text-[11px] text-ink-4 transition-colors hover:border-ink-4/40 hover:text-ink-2"
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-auto flex items-center gap-3 text-[12px] text-ink-4">
                <span className="tabular-nums text-ink-3">★ {formatStars(repo.stars)}</span>
                {repo.language ? <span>{repo.language}</span> : null}
                {mode === "skill" && isSkill ? (
                  <span className="tabular-nums text-hot" title="stars × 5 加权分">
                    分 {formatStars(score)}
                  </span>
                ) : null}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
