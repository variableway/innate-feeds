import { useMemo } from "react";
import type { FeedFilters, FeedItem } from "@/types/feed";
import { useFeedList } from "@/hooks/use-feed-list";
import { FeedCard } from "@/components/feed-card";
import { EmptyState, PillTabs } from "@/components/layout";

/**
 * 主页（sprint-3 B3）：AIHot 精选流——trending 快照按日期倒序的时间轨。
 * 结构：PillTabs 排序 → 日分组（sticky 日期头）→ FeedCard 流。
 */

type SortKey = NonNullable<FeedFilters["sort"]>;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "stars", label: "高星" },
  { value: "updated", label: "最近更新" },
  { value: "created", label: "新创建" },
];

interface DayGroup {
  date: string;
  items: FeedItem[];
}

function groupByDate(items: FeedItem[]): DayGroup[] {
  const map = new Map<string, FeedItem[]>();
  for (const item of items) {
    const date = item.snapshotDate ?? "unknown";
    const list = map.get(date);
    if (list) list.push(item);
    else map.set(date, [item]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, items: list }));
}

function formatDay(date: string): string {
  if (date === "unknown") return "未标注快照日";
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date === today) return `今天 · ${date}`;
  if (date === yesterday) return `昨天 · ${date}`;
  return date;
}

export function HomePage() {
  const { items, filters, loading, handleFiltersChange, handleTopicClick, handleHideItem } =
    useFeedList("trending", { sort: "stars" });

  const groups = useMemo(() => groupByDate(items), [items]);

  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] px-1 pb-14">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-5 lg:pt-0">
        <div>
          <p className="text-[13px] text-hot">精选流</p>
          <h1 className="text-lg font-semibold text-ink">GitHub Trending 时间轨</h1>
        </div>
        <PillTabs
          ariaLabel="排序"
          options={SORT_OPTIONS}
          value={filters.sort ?? "stars"}
          onChange={(sort) => handleFiltersChange({ ...filters, sort })}
        />
      </header>

      {loading ? (
        <EmptyState title="加载中…">正在拉取最新 trending 快照</EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState title="还没有 trending 数据">
          先跑一次采集：<code className="text-ink-3">cd backend && bun src/app/cli.ts sync job trending-daily</code>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.date} aria-label={group.date}>
              <div className="sticky top-0 z-10 -mx-1 border-b border-border/60 bg-background/95 px-1 py-2 backdrop-blur">
                <h2 className="flex items-baseline gap-2 text-[13px] font-medium text-ink-3">
                  <span className="text-ink">{formatDay(group.date)}</span>
                  <span className="tabular-nums text-ink-4">{group.items.length} 个仓库</span>
                </h2>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    onTopicClick={handleTopicClick}
                    onHide={handleHideItem}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
