import { Link, useParams } from "@tanstack/react-router";
import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchExternalSource } from "@/services/external";
import type { ExternalSourcePayload } from "@/types/external";
import { EXTERNAL_SOURCE_META } from "@/types/external";
import { ExternalItemCard } from "@/components/external-item-card";
import { formatDate } from "@/lib/utils";

/**
 * 单个外部数据源的最新快照（GH #31，/feeds/$source）。
 * 列表为采集器保存的最新一份 manifest 快照，不是实时抓取。
 */
export function FeedsSourcePage() {
  const params = useParams({ strict: false }) as { source?: string };
  const source = params.source ?? "hackernews";
  const [payload, setPayload] = useState<ExternalSourcePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const meta = useMemo(
    () =>
      EXTERNAL_SOURCE_META.find((m) => m.source === source) ?? {
        source: source as never,
        title: source,
        description: "",
        homepage: "",
        icon: "Newspaper",
        metrics: [],
        emptyHint: "Run the collector to populate this source.",
      },
    [source],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchExternalSource(source as never)
      .then((data) => {
        if (!cancelled) setPayload(data);
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
  }, [source]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payload?.items ?? [];
    return (payload?.items ?? []).filter((item) =>
      [item.title, item.tagline, item.description, ...item.categories]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [payload, search]);

  return (
    <div className="w-full space-y-4 p-4">
      <header className="space-y-1">
        <Link
          to="/feeds"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Feeds
        </Link>
        <h1 className="text-lg font-semibold text-foreground">{meta.title}</h1>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter items…"
            aria-label="Filter items"
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {payload?.fetchedAt && (
          <span className="text-xs text-muted-foreground">
            snapshot {payload.label || "—"} · synced{" "}
            {formatDate(payload.fetchedAt)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {payload && payload.items.length === 0
            ? meta.emptyHint
            : `No item matches "${search}".`}
        </div>
      ) : (
        <>
          {search && (
            <p className="text-xs text-muted-foreground">
              {items.length} of {payload?.items.length ?? 0} items
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ExternalItemCard
                key={item.id}
                item={item}
                metrics={meta.metrics}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
