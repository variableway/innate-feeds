import * as React from "react";
import { ExternalLink, GitFork, Star, TrendingUp } from "lucide-react";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { TrendshiftRepo } from "@/types/trendshift";
import type { TrendshiftPeriodGroup } from "@/hooks/use-trendshift";

const SOCIAL_LABELS: Record<string, string> = {
  x: "X",
  reddit: "Reddit",
  hackernews: "HN",
};

interface TrendshiftRowProps {
  row: TrendshiftRepo;
  maxGained: number;
}

function TrendshiftRow({ row, maxGained }: TrendshiftRowProps) {
  const gained = row.starsGained ?? 0;
  const barWidth = maxGained > 0 ? Math.max(2, (gained / maxGained) * 100) : 0;

  return (
    <div className="group relative overflow-hidden rounded-md border bg-card px-3 py-2 transition-colors hover:border-primary/40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10"
        style={{ width: `${barWidth}%` }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="w-8 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-muted-foreground"
          title="Rank"
        >
          {row.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <a
              href={row.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
            >
              {row.fullName}
              <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </a>
            {row.language && (
              <span className="text-xs text-muted-foreground">
                {row.language}
              </span>
            )}
            {row.createdAt && (
              <span className="text-xs text-muted-foreground">
                {formatDate(row.createdAt)}
              </span>
            )}
          </div>
          {row.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {row.description}
            </p>
          )}
          {(row.tags.length > 0 || row.socialMentionPlatforms.length > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {row.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {row.socialMentionPlatforms.map((p) => (
                <span
                  key={p}
                  title={`Mentioned on ${SOCIAL_LABELS[p] ?? p}`}
                  className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
                >
                  {SOCIAL_LABELS[p] ?? p}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 pt-0.5 text-xs tabular-nums">
          <span
            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
            title="Stars gained in period"
          >
            <TrendingUp className="h-3.5 w-3.5" />+{formatNumber(gained)}
          </span>
          <span
            className="hidden items-center gap-1 text-muted-foreground sm:inline-flex"
            title="Total stars"
          >
            <Star className="h-3.5 w-3.5" />
            {formatNumber(row.starsTotal ?? 0)}
          </span>
          <span
            className="hidden items-center gap-1 text-muted-foreground md:inline-flex"
            title="Total forks"
          >
            <GitFork className="h-3.5 w-3.5" />
            {formatNumber(row.forksTotal ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TrendshiftListProps extends React.HTMLAttributes<HTMLDivElement> {
  groups: TrendshiftPeriodGroup[];
  hasMorePeriods: boolean;
  loading: boolean;
  error: string | null;
  onLoadMorePeriods: () => void;
}

const TrendshiftList = React.forwardRef<HTMLDivElement, TrendshiftListProps>(
  (
    {
      groups,
      hasMorePeriods,
      loading,
      error,
      onLoadMorePeriods,
      className,
      ...props
    },
    ref,
  ) => {
    const sentinelRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      const node = sentinelRef.current;
      if (!node || !hasMorePeriods) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) onLoadMorePeriods();
        },
        { rootMargin: "600px" },
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, [hasMorePeriods, onLoadMorePeriods]);

    if (error) {
      return (
        <div
          ref={ref}
          className={cn(
            "rounded-md border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-destructive",
            className,
          )}
          {...props}
        >
          {error}
        </div>
      );
    }

    if (!loading && groups.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "rounded-md border px-4 py-10 text-center text-sm text-muted-foreground",
            className,
          )}
          {...props}
        >
          No repositories match the current filters.
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-6", className)}
        {...props}
      >
        {groups.map((group) => (
          <section
            key={group.periodKey}
            aria-label={`Period ${group.periodKey}`}
          >
            <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {group.periodKey}
              </h3>
              <span className="text-xs text-muted-foreground">
                {group.rows.length} repos
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3 w-3" />+
                {formatNumber(group.totalGained)} gained
              </span>
            </header>
            <div className="flex flex-col gap-2">
              {group.rows.map((row) => (
                <TrendshiftRow
                  key={`${row.periodKey}-${row.fullName}`}
                  row={row}
                  maxGained={group.maxGained}
                />
              ))}
            </div>
          </section>
        ))}

        {hasMorePeriods && (
          <div ref={sentinelRef} className="flex justify-center py-2">
            <button
              type="button"
              onClick={onLoadMorePeriods}
              className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Load earlier periods
            </button>
          </div>
        )}
      </div>
    );
  },
);
TrendshiftList.displayName = "TrendshiftList";

export { TrendshiftList };
