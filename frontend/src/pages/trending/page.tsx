import { useNavigate, useParams } from "@tanstack/react-router";
import type { FeedFilters, FeedItem } from "@/types/feed";
import { useFeedList } from "@/hooks/use-feed-list";
import { FeedListPage } from "@/components/feed-list-page";

const DEFAULT_FILTERS: FeedFilters = { sort: "stars" };

export function TrendingPage() {
  const params = useParams({ strict: false }) as { repoId?: string };
  const navigate = useNavigate();
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

  const openDetail = (item: FeedItem) => {
    void navigate({
      to: "/trending/$repoId",
      params: { repoId: String(item.repo.id) },
    });
  };

  const closeDetail = () => {
    void navigate({ to: "/trending" });
  };

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
      selectedRepoId={params.repoId ?? null}
      emptyMessage="No trending repositories found."
      onFiltersChange={handleFiltersChange}
      onTopicClick={handleTopicClick}
      onPageChange={setPage}
      onSelectItem={openDetail}
      onCloseDetail={closeDetail}
    />
  );
}
