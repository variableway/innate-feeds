import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { fetchDates, fetchFeeds } from "@/services/feeds";
import { fetchTrendshiftSlice } from "@/services/trendshift";
import { EmptyState } from "@/components/layout";
import type { FeedItem } from "@/types/feed";

/**
 * 主页 v2（sprint-3 B16）：双区块。
 * ① 3 天 GitHub 热榜：最近 3 个快照日的 trending 与 trendshift（daily，最近 3 期）
 *    合并去重，按 stars 排序，2 行网格分页（每页 8）。
 * ② 主题卡片：EDU 与 UI/UX Design 各一张，Top 5 列表 + 「查看更多」跳转。
 */

interface HotRepo {
  fullName: string;
  description: string;
  language: string | null;
  stars: number;
  gained: number | null;
  fromTrending: boolean;
  fromTrendshift: boolean;
  url: string;
}

const HOT_PAGE_SIZE = 8; // 2 行 × 4 列（xl）

function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function useHotPool() {
  const [pool, setPool] = useState<HotRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dates = await fetchDates();
        const last3 = dates.slice(0, 3);
        const [trendingLists, trendshiftRaw] = await Promise.all([
          Promise.all(
            last3.map((date) =>
              fetchFeeds("trending", { date, sort: "stars" }, 1, 50).catch(
                () => null,
              ),
            ),
          ),
          fetchTrendshiftSlice("daily", "all").catch(() => []),
        ]);
        if (cancelled) return;

        // trendshift：只取最近 3 期（periodKey 倒序）
        const periods = [...new Set(trendshiftRaw.map((r) => r.periodKey))]
          .sort()
          .reverse()
          .slice(0, 3);
        const tsMap = new Map<string, { stars: number; gained: number | null; url: string; description: string; language: string | null }>();
        for (const r of trendshiftRaw) {
          if (!periods.includes(r.periodKey)) continue;
          if (!tsMap.has(r.fullName)) {
            tsMap.set(r.fullName, {
              stars: r.starsTotal ?? 0,
              gained: r.starsGained ?? null,
              url: r.githubUrl,
              description: r.description ?? "",
              language: r.language ?? null,
            });
          }
        }

        // trending：3 天合并去重（保留更新快照）
        const tMap = new Map<string, FeedItem>();
        for (const list of trendingLists) {
          if (!list) continue;
          for (const item of list.items) {
            const prev = tMap.get(item.repo.fullName);
            if (
              !prev ||
              (item.snapshotDate ?? "") > (prev.snapshotDate ?? "")
            ) {
              tMap.set(item.repo.fullName, item);
            }
          }
        }

        const merged = new Map<string, HotRepo>();
        for (const [fullName, item] of tMap) {
          const ts = tsMap.get(fullName);
          merged.set(fullName, {
            fullName,
            description: item.repo.description ?? "",
            language: item.repo.language,
            stars: item.repo.stars,
            gained: ts?.gained ?? null,
            fromTrending: true,
            fromTrendshift: Boolean(ts),
            url: item.repo.url,
          });
        }
        for (const [fullName, ts] of tsMap) {
          if (!merged.has(fullName)) {
            merged.set(fullName, {
              fullName,
              description: ts.description,
              language: ts.language,
              stars: ts.stars,
              gained: ts.gained,
              fromTrending: false,
              fromTrendshift: true,
              url: ts.url,
            });
          }
        }
        setPool(
          [...merged.values()].sort((a, b) => b.stars - a.stars),
        );
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { pool, error };
}

interface TopicRow {
  title: string;
  detail: string;
  url: string;
  hot: boolean;
}

/** EDU Top5：安装量（回退 stars）× (core ? 5 : 1)，与域内打分同构。 */
async function loadEduTop5(): Promise<TopicRow[]> {
  const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";
  const res = await fetch(
    IS_STATIC ? "/data/external/edu-skills.json" : "/api/external/edu-skills",
  );
  if (!res.ok) return [];
  const payload = (await res.json()) as {
    items?: {
      title: string;
      url: string;
      metrics?: { score?: number; stars?: number };
      metadata?: { installs?: number; relevance?: string };
    }[];
  };
  return (payload.items ?? [])
    .map((i) => {
      const base =
        i.metadata?.installs ??
        i.metrics?.score ??
        i.metrics?.stars ??
        0;
      return {
        row: {
          title: i.title,
          url: i.url,
          detail: `分 ${formatStars(base * (i.metadata?.relevance === "core" ? 5 : 1))}`,
          hot: i.metadata?.relevance === "core",
        } as TopicRow,
        score: base * (i.metadata?.relevance === "core" ? 5 : 1),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.row);
}

const UX_TOPICS = ["design-system", "ui", "ux"];
const UX_SKILL_TOPICS = new Set([
  "skills",
  "agent-skills",
  "claude-code",
  "claude",
  "cursor",
  "ai-agents",
  "agents",
]);

/** UI/UX Top5：stars × (SKILL ? 5 : 1)，与 /ux 页同构。 */
async function loadUxTop5(): Promise<TopicRow[]> {
  const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";
  const lists = await Promise.all(
    UX_TOPICS.map(async (t) => {
      const res = await fetch(
        IS_STATIC ? `/data/topics/${t}.json` : `/api/topics/${t}`,
      );
      if (!res.ok) return [];
      const payload = (await res.json()) as {
        items?: {
          fullName: string;
          description: string;
          url: string;
          stars: number;
          topics?: string[];
        }[];
      };
      return payload.items ?? [];
    }),
  );
  const byName = new Map<string, { repo: (typeof lists)[0][number]; isSkill: boolean }>();
  for (const list of lists) {
    for (const repo of list) {
      const isSkill =
        /\bskill(s)?\b/i.test(repo.fullName) ||
        /\bskill(s)?\b/i.test(repo.description ?? "") ||
        (repo.topics ?? []).some((t) => UX_SKILL_TOPICS.has(t));
      const prev = byName.get(repo.fullName);
      if (!prev || repo.stars > prev.repo.stars) {
        byName.set(repo.fullName, { repo, isSkill: isSkill || prev?.isSkill === true });
      } else if (isSkill && prev) {
        prev.isSkill = true;
      }
    }
  }
  return [...byName.values()]
    .map((m) => ({
      row: {
        title: m.repo.fullName,
        url: m.repo.url,
        detail: `★ ${formatStars(m.repo.stars)}`,
        hot: m.isSkill,
      } as TopicRow,
      score: m.repo.stars * (m.isSkill ? 5 : 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.row);
}

function TopicCard({
  kicker,
  title,
  rows,
  to,
  loading,
}: {
  kicker: string;
  title: string;
  rows: TopicRow[];
  to: string;
  loading: boolean;
}) {
  const navigate = useNavigate();
  return (
    <section className="rounded-panel border bg-card p-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-[12px] text-hot">{kicker}</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => void navigate({ to })}
          className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline"
        >
          查看更多 →
        </button>
      </header>
      <ul className="mt-3 divide-y divide-border/60">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="py-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              </li>
            ))
          : rows.map((r, i) => (
              <li key={r.url} className="flex items-center gap-3 py-2">
                <span className="w-4 shrink-0 text-[12px] tabular-nums text-rank-rest">
                  {i + 1}
                </span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-[14px] text-ink-2 hover:underline"
                >
                  {r.title}
                </a>
                {r.hot ? (
                  <span className="shrink-0 rounded-mark bg-hot px-1.5 py-0.5 text-[10px] font-bold uppercase text-background">
                    hot
                  </span>
                ) : null}
                <span className="shrink-0 text-[12px] tabular-nums text-ink-4">
                  {r.detail}
                </span>
              </li>
            ))}
      </ul>
    </section>
  );
}

export function HomePage() {
  const { pool, error } = useHotPool();
  const [page, setPage] = useState(1);
  const [eduRows, setEduRows] = useState<TopicRow[] | null>(null);
  const [uxRows, setUxRows] = useState<TopicRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEduTop5()
      .then((r) => !cancelled && setEduRows(r))
      .catch(() => !cancelled && setEduRows([]));
    loadUxTop5()
      .then((r) => !cancelled && setUxRows(r))
      .catch(() => !cancelled && setUxRows([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = pool ? Math.max(1, Math.ceil(pool.length / HOT_PAGE_SIZE)) : 1;
  const pageItems = useMemo(() => {
    if (!pool) return [];
    return pool.slice((page - 1) * HOT_PAGE_SIZE, page * HOT_PAGE_SIZE);
  }, [pool, page]);

  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] px-1 pb-14">
      <header className="pb-5 pt-5 lg:pt-0">
        <p className="text-[13px] text-hot">精选流</p>
        <h1 className="text-lg font-semibold text-ink">Innate Feeds</h1>
      </header>

      {/* ============ 第一部分：3 天 GitHub 热榜 ============ */}
      <section aria-label="3 天 GitHub 热榜">
        <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
          <h2 className="text-[15px] font-semibold text-ink">
            3 天 GitHub 热榜
            <span className="ml-2 text-[12px] font-normal text-ink-4">
              trending × trendshift 合并去重
            </span>
          </h2>
          {pool ? (
            <span className="text-[12px] tabular-nums text-ink-4">
              {pool.length} 仓库
            </span>
          ) : null}
        </div>

        {error ? (
          <EmptyState title="热榜加载失败">{error}</EmptyState>
        ) : !pool ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: HOT_PAGE_SIZE }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-card border bg-card" />
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <EmptyState title="暂无数据">
            先跑一次采集：<code className="text-ink-3">cli sync job trending-daily</code>
          </EmptyState>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {pageItems.map((repo) => (
                <a
                  key={repo.fullName}
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full flex-col gap-1.5 rounded-card border bg-card p-3.5 transition-colors hover:border-ink-4/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words text-[13px] font-semibold text-ink">
                      {repo.fullName}
                    </h3>
                    {repo.fromTrendshift ? (
                      <span
                        title={repo.gained != null ? `trendshift 日增 +${repo.gained}` : "trendshift 在榜"}
                        className="shrink-0 rounded-mark bg-hot-soft px-1.5 py-0.5 text-[10px] font-semibold text-hot"
                      >
                        TS{repo.gained != null ? `+${formatStars(repo.gained)}` : ""}
                      </span>
                    ) : null}
                  </div>
                  {repo.description ? (
                    <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-3">
                      {repo.description}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center gap-2 text-[12px] text-ink-4">
                    <span className="tabular-nums text-ink-3">★ {formatStars(repo.stars)}</span>
                    {repo.language ? <span className="truncate">{repo.language}</span> : null}
                  </div>
                </a>
              ))}
            </div>
            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-3 text-[13px]">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-control border px-3 py-1 text-ink-2 hover:bg-accent disabled:opacity-50"
                >
                  ← 上一页
                </button>
                <span className="tabular-nums text-ink-4">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-control border px-3 py-1 text-ink-2 hover:bg-accent disabled:opacity-50"
                >
                  下一页 →
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* ============ 第二部分：主题 ============ */}
      <section aria-label="主题" className="mt-10">
        <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
          <h2 className="text-[15px] font-semibold text-ink">主题</h2>
          <span className="text-[12px] text-ink-4">Top 5 · 按域内打分</span>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <TopicCard
            kicker="主题 · Education"
            title="EDU 教育动画 SKILL"
            rows={eduRows ?? []}
            loading={eduRows === null}
            to="/edu"
          />
          <TopicCard
            kicker="主题 · Design"
            title="UI/UX Design SKILL"
            rows={uxRows ?? []}
            loading={uxRows === null}
            to="/ux"
          />
        </div>
      </section>
    </div>
  );
}
