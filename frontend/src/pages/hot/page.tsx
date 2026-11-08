import { useEffect, useState } from "react";
import type { HotItem, HotSignal, HotSnapshotDTO } from "@/types/hot";
import { getHotSnapshot } from "@/services/hot";

const SOURCE_LABELS: Record<string, string> = {
  trending: "Trending",
  trendshift: "Trendshift",
  digest: "Digest 精选",
  "github-new": "新仓库",
};

function SignalBadge({ signal }: { signal: HotSignal }) {
  const label = SOURCE_LABELS[signal.source] ?? signal.label ?? signal.source;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      {label}
      {signal.rank ? (
        <span className="font-medium text-foreground">#{signal.rank}</span>
      ) : null}
    </span>
  );
}

function HotRow({ item }: { item: HotItem }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="w-8 shrink-0 text-center">
        <div
          className={`text-sm font-semibold ${
            item.rank <= 3 ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {item.rank}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {item.heat.toFixed(2)}
        </div>
      </div>
      <img
        src={item.ownerAvatarUrl}
        alt=""
        loading="lazy"
        className="mt-0.5 h-8 w-8 shrink-0 rounded-full border"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://github.com/${item.fullName}`}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm font-medium hover:underline"
          >
            {item.fullName}
          </a>
          {item.language ? (
            <span className="text-[11px] text-muted-foreground">
              {item.language}
            </span>
          ) : null}
          {item.stars != null ? (
            <span className="text-[11px] text-muted-foreground">
              ★ {item.stars.toLocaleString()}
            </span>
          ) : null}
          {item.starsGained != null ? (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              +{item.starsGained.toLocaleString()} (48h)
            </span>
          ) : null}
          {item.isNew ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              New
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {item.description}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {item.signals.map((s) => (
            <SignalBadge key={`${s.source}-${s.label ?? ""}`} signal={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * GitHub Hot (GH #63, M1) — cross-source heat ranking:
 * digest / trending / trendshift / github-new signals × 24h half-life.
 * M2 前的小增量页面；Topic Hub 将取代此页的最终形态。
 */
export function HotPage() {
  const [snapshot, setSnapshot] = useState<HotSnapshotDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHotSnapshot(50)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((err: unknown) => {
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

  return (
    <div className="w-full space-y-4 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">GitHub Hot</h1>
          <p className="text-xs text-muted-foreground">
            跨源信号热度榜（digest / trending / trendshift / github-new × 24h
            半衰）
          </p>
        </div>
        {snapshot ? (
          <div className="text-right text-[11px] text-muted-foreground">
            <div>快照 {snapshot.snapshotDate}</div>
            <div className="font-mono">{snapshot.ruleVersion}</div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading hot ranking…
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          加载失败：{error}
        </div>
      ) : snapshot && snapshot.items.length > 0 ? (
        <div className="space-y-2">
          {snapshot.items.map((item) => (
            <HotRow key={item.fullName} item={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          暂无快照——每日管线（data:update:local）产出后可见。
        </div>
      )}
    </div>
  );
}
