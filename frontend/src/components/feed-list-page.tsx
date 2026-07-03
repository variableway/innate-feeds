import type { FeedItem, FeedFilters } from "@/types/feed";
import { FeedCard } from "@/components/feed-card";
import { FilterBar } from "@/components/filter-bar";

interface FeedListPageProps {
  items: FeedItem[];
  filters: FeedFilters;
  languages: string[];
  dates: string[];
  loading: boolean;
  page: number;
  total: number;
  pageSize: number;
  showStarsRange?: boolean;
  emptyMessage: string;
  onFiltersChange: (filters: FeedFilters) => void;
  onTopicClick: (topic: string) => void;
  onPageChange: (page: number) => void;
}

export function FeedListPage({
  items,
  filters,
  languages,
  dates,
  loading,
  page,
  total,
  pageSize,
  showStarsRange = false,
  emptyMessage,
  onFiltersChange,
  onTopicClick,
  onPageChange,
}: FeedListPageProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <div className="mb-6">
        <FilterBar
          filters={filters}
          languages={languages}
          dates={dates}
          showStarsRange={showStarsRange}
          onFiltersChange={onFiltersChange}
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
            {emptyMessage}
          </div>
        ) : (
          items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              selectedTopics={filters.topics}
              onTopicClick={onTopicClick}
            />
          ))
        )}
      </div>

      {total > pageSize && (
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Previous
          </button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
