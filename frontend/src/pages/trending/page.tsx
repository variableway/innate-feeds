import type { FeedFilters } from "@/types/feed";
import { useFeedList } from "@/hooks/use-feed-list";
import { FeedListPage } from "@/components/feed-list-page";

const DEFAULT_FILTERS: FeedFilters = { sort: "stars" };

export function TrendingPage() {
  const {
    items,
    languages,
    dates,
    filters,
    loading,
    page,
    total,
    pageSize,
    setPage,
    handleFiltersChange,
    handleTopicClick,
  } = useFeedList("trending", DEFAULT_FILTERS);

  return (
    <FeedListPage
      items={items}
      filters={filters}
      languages={languages}
      dates={dates}
      loading={loading}
      page={page}
      total={total}
      pageSize={pageSize}
      emptyMessage="No trending repositories found."
      onFiltersChange={handleFiltersChange}
      onTopicClick={handleTopicClick}
      onPageChange={setPage}
    />
  );
}
