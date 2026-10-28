import { useTrendshift } from "@/hooks/use-trendshift";
import { TrendshiftToolbar } from "@/components/trendshift-toolbar";
import { TrendshiftList } from "@/components/trendshift-list";

/**
 * Trending Shift (GH #23) — Trendshift ranking archives:
 * timeframe tabs + per-period archive scroll + stars-gained deltas.
 */
export function TrendingShiftPage() {
  const {
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
    shownGroups,
    hasMorePeriods,
    loadMorePeriods,
  } = useTrendshift();

  return (
    <div className="w-full space-y-4 p-3">
      <TrendshiftToolbar
        timeframe={timeframe}
        language={language}
        sort={sort}
        search={search}
        onTimeframeChange={setTimeframe}
        onLanguageChange={setLanguage}
        onSortChange={setSort}
        onSearchChange={setSearch}
      />

      {loading && shownGroups.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading trendshift archives…
        </div>
      ) : (
        <TrendshiftList
          groups={shownGroups}
          hasMorePeriods={hasMorePeriods}
          loading={loading}
          error={error}
          onLoadMorePeriods={loadMorePeriods}
        />
      )}
    </div>
  );
}
