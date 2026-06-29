import { useState, useEffect, useCallback } from "react";
import type { FeedItem, FeedFilters } from "@/types/feed";
import { toggleTopicFilter } from "@/types/feed";
import { fetchFeeds, fetchLanguages } from "@/services/feeds";
import { FeedCard } from "@/components/feed-card";
import { FilterBar } from "@/components/filter-bar";
import { usePersistedFeedFilters } from "@/hooks/use-persisted-feed-filters";
import { toast } from "sonner";

const DEFAULT_FILTERS: FeedFilters = {
  sort: "stars",
  order: "desc",
};

export function StarredPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [filters, setFilters] = usePersistedFeedFilters("starred", DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [feedRes, langsRes] = await Promise.all([
        fetchFeeds("starred", filters, page, pageSize),
        fetchLanguages(),
      ]);
      setItems(feedRes.items);
      setTotal(feedRes.total);
      setLanguages(langsRes);
    } catch (err) {
      toast.error("Failed to load starred feeds");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFiltersChange = (next: FeedFilters) => {
    setPage(1);
    setFilters(next);
  };

  const handleTopicClick = (topic: string) => {
    handleFiltersChange(toggleTopicFilter(filters, topic));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <FilterBar
          filters={filters}
          languages={languages}
          dates={[]}
          showStarsRange
          onFiltersChange={handleFiltersChange}
        />
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border bg-card"
            />
          ))
        ) : items.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            No starred repositories found.
          </div>
        ) : (
          items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              selectedTopics={filters.topics}
              onTopicClick={handleTopicClick}
            />
          ))
        )}
      </div>

      {total > pageSize && (
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Previous
          </button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / pageSize)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
