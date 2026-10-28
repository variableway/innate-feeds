import * as React from "react";
import { fetchTrendshiftSlice } from "@/services/trendshift";
import type {
  TrendshiftLanguageFilter,
  TrendshiftRepo,
  TrendshiftSort,
  TrendshiftTimeframe,
} from "@/types/trendshift";

/** Periods rendered at once when scrolling the archive (P1 渐进归档). */
const PERIODS_PER_STEP = 3;

export interface TrendshiftPeriodGroup {
  periodKey: string;
  rows: TrendshiftRepo[];
  totalGained: number;
  maxGained: number;
}

function sortRows(
  rows: TrendshiftRepo[],
  sort: TrendshiftSort,
): TrendshiftRepo[] {
  const copy = [...rows];
  switch (sort) {
    case "stars-gained":
      return copy.sort((a, b) => (b.starsGained ?? 0) - (a.starsGained ?? 0));
    case "stars-total":
      return copy.sort((a, b) => (b.starsTotal ?? 0) - (a.starsTotal ?? 0));
    case "newest":
      return copy.sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      );
    case "rank":
    default:
      return copy.sort((a, b) => a.rank - b.rank);
  }
}

function matchesSearch(row: TrendshiftRepo, needle: string): boolean {
  if (!needle) return true;
  const hay =
    `${row.fullName} ${row.description} ${row.language ?? ""} ${row.tags.join(" ")}`.toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

export function useTrendshift() {
  const [timeframe, setTimeframe] =
    React.useState<TrendshiftTimeframe>("daily");
  const [language, setLanguage] =
    React.useState<TrendshiftLanguageFilter>("all");
  const [sort, setSort] = React.useState<TrendshiftSort>("rank");
  const [search, setSearch] = React.useState("");
  const [rows, setRows] = React.useState<TrendshiftRepo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [visiblePeriods, setVisiblePeriods] = React.useState(PERIODS_PER_STEP);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVisiblePeriods(PERIODS_PER_STEP);
    fetchTrendshiftSlice(timeframe, language)
      .then((items) => {
        if (!cancelled) setRows(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRows([]);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load trendshift data",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [timeframe, language]);

  const groups = React.useMemo(() => {
    const byPeriod = new Map<string, TrendshiftRepo[]>();
    for (const row of rows) {
      if (!matchesSearch(row, search)) continue;
      const bucket = byPeriod.get(row.periodKey);
      if (bucket) bucket.push(row);
      else byPeriod.set(row.periodKey, [row]);
    }
    const out: TrendshiftPeriodGroup[] = [];
    for (const [periodKey, periodRows] of byPeriod) {
      const sorted = sortRows(periodRows, sort);
      let totalGained = 0;
      let maxGained = 0;
      for (const r of sorted) {
        const gained = r.starsGained ?? 0;
        totalGained += gained;
        if (gained > maxGained) maxGained = gained;
      }
      out.push({ periodKey, rows: sorted, totalGained, maxGained });
    }
    // Newest period first; keys sort lexicographically in every timeframe format.
    return out.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  }, [rows, search, sort]);

  const shownGroups = React.useMemo(
    () => groups.slice(0, visiblePeriods),
    [groups, visiblePeriods],
  );

  const hasMorePeriods = visiblePeriods < groups.length;

  const loadMorePeriods = React.useCallback(() => {
    setVisiblePeriods((n) => n + PERIODS_PER_STEP);
  }, []);

  return {
    timeframe,
    setTimeframe,
    language,
    setLanguage,
    sort,
    setSort,
    search,
    setSearch,
    loading,
    error,
    groups,
    shownGroups,
    hasMorePeriods,
    loadMorePeriods,
  };
}
