import { useEffect, useState } from "react";
import type { TopicResponse } from "../../../../shared/types/topics";

/**
 * UI/UX Design 主题 Hub v1（sprint-3 B10，AIHot 富头部 + 索引网格）。
 * 数据：/api/topics/:topic（API 模式）或 /data/topics/:topic.json（静态模式）。
 */

const TOPICS: { id: string; label: string }[] = [
  { id: "design-system", label: "设计系统" },
  { id: "ui", label: "UI" },
  { id: "ux", label: "UX" },
  { id: "design", label: "Design" },
  { id: "ui-components", label: "组件库" },
  { id: "component-library", label: "组件框架" },
  { id: "figma", label: "Figma" },
  { id: "accessibility", label: "无障碍" },
  { id: "tailwindcss", label: "Tailwind" },
  { id: "shadcn-ui", label: "shadcn/ui" },
];

const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";

async function fetchTopic(topic: string): Promise<TopicResponse> {
  const url = IS_STATIC
    ? `/data/topics/${topic}.json`
    : `/api/topics/${topic}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load topic ${topic}: ${res.status}`);
  return (await res.json()) as TopicResponse;
}

function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function UxDesignPage() {
  const [topic, setTopic] = useState("design-system");
  const [data, setData] = useState<TopicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTopic(topic)
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [topic]);

  return (
    <div>
      {/* AIHot 富头部 */}
      <header className="mb-8">
        <p className="text-[13px] text-hot">主题 · Topic</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">UI/UX Design</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
          设计系统、组件库、Figma 生态与无障碍——GitHub Topics 每日 top 快照，
          由 <code className="text-ink-4">sync github-topics</code> 采集。
        </p>
        {data ? (
          <p className="mt-3 flex gap-4 text-[13px] tabular-nums text-ink-4">
            <span>
              快照 <span className="text-ink-2">{data.count}</span> 仓库
            </span>
            <span>
              新发现 <span className="text-hot">{data.newCount}</span>
            </span>
            <span>
              已在 feeds <span className="text-ink-2">{data.existingCount}</span>
            </span>
            <span>fetched {data.fetchedAt.slice(0, 10)}</span>
          </p>
        ) : null}
      </header>

      {/* 主题切换药丸（域内自绘，AIHot 风格） */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Topic">
        {TOPICS.map((t) => {
          const active = t.id === topic;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTopic(t.id)}
              className={
                active
                  ? "rounded-full border border-transparent bg-ink px-3 py-1 text-[13px] leading-5 text-background"
                  : "rounded-full border border-border px-3 py-1 text-[13px] leading-5 text-ink-3 transition-colors hover:border-ink-4/40 hover:text-ink"
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="py-20 text-center text-sm text-ink-4">加载中…</p>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <p className="text-sm font-medium text-ink-2">{error}</p>
          <p className="text-[13px] text-ink-4">
            先采集：<code>cd backend && bun src/app/cli.ts sync job github-topics</code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data?.items ?? []).map((repo) => (
            <a
              key={repo.id}
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full flex-col gap-2 rounded-card border bg-card p-4 transition-colors hover:border-ink-4/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-sm font-semibold text-ink">
                  {repo.fullName}
                </h3>
                {repo.isNew ? (
                  <span className="shrink-0 rounded-mark bg-hot px-1.5 py-0.5 text-[10px] font-semibold uppercase text-background">
                    New
                  </span>
                ) : null}
              </div>
              {repo.description ? (
                <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-3">
                  {repo.description}
                </p>
              ) : null}
              <div className="mt-auto flex items-center gap-3 text-[12px] text-ink-4">
                <span className="tabular-nums text-ink-3">★ {formatStars(repo.stars)}</span>
                {repo.language ? <span>{repo.language}</span> : null}
                {repo.existing ? <span className="text-ink-4">in feeds</span> : null}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
