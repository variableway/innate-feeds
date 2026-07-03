import type { FeedFilters } from "@/types/feed";
import { useFeedList } from "@/hooks/use-feed-list";
import { FeedListPage } from "@/components/feed-list-page";

const DEFAULT_FILTERS: FeedFilters = {
  sort: "stars",
  order: "desc",
};

export function StarredPage() {
  const {
    items,
    languages,
    filters,
    loading,
    page,
    total,
    pageSize,
    setPage,
    handleFiltersChange,
    handleTopicClick,
  } = useFeedList("starred", DEFAULT_FILTERS);

  return (
    <FeedListPage
      items={items}
      filters={filters}
      languages={languages}
      dates={[]}
      loading={loading}
      page={page}
      total={total}
      pageSize={pageSize}
      showStarsRange
      emptyMessage="No starred repositories found."
      onFiltersChange={handleFiltersChange}
      onTopicClick={handleTopicClick}
      onPageChange={setPage}
    />
  );
}
