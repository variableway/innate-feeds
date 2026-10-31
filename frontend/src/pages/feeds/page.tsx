import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchExternalIndex } from "@/services/external";
import type { ExternalIndex } from "@/types/external";
import { EXTERNAL_SOURCE_META } from "@/types/external";
import { formatDate } from "@/lib/utils";

/**
 * Feeds 总览（GH #31）：所有外部数据源的索引卡片。
 * 每个源一张卡，点进去是该源的最新快照（/feeds/$source）。
 */
export function FeedsPage() {
  const [index, setIndex] = useState<ExternalIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchExternalIndex()
      .then((payload) => {
        if (!cancelled) setIndex(payload);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bySource = useMemo(() => {
    const map = new Map<string, { count: number; fetchedAt: string | null }>();
    for (const entry of index?.sources ?? []) {
      map.set(entry.source, {
        count: entry.count,
        fetchedAt: entry.fetchedAt,
      });
    }
    return map;
  }, [index]);

  const metas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return EXTERNAL_SOURCE_META;
    return EXTERNAL_SOURCE_META.filter((meta) =>
      [meta.title, meta.description, meta.source]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [search]);

  return (
    <div className="w-full space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Feeds</h1>
        <p className="text-sm text-muted-foreground">
          外部数据源总览：社区热帖（Hacker News / lobste.rs / Dev.to）、模型趋势
          （Hugging Face）、新项目（GitHub New）与投资组合（Product Hunt / YC /
          a16z）。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter sources…"
            aria-label="Filter sources"
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {index?.updatedAt && (
          <span className="text-xs text-muted-foreground">
            index {formatDate(index.updatedAt)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metas.map((meta) => {
            const state = bySource.get(meta.source);
            return (
              <Link
                key={meta.source}
                to="/feeds/$source"
                params={{ source: meta.source }}
                className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground group-hover:underline">
                    {meta.title}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {meta.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {state?.count ? (
                    <>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                        {state.count} items
                      </span>
                      {state.fetchedAt && (
                        <span>synced {formatDate(state.fetchedAt)}</span>
                      )}
                    </>
                  ) : (
                    <span className="italic opacity-70">Not synced yet</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
