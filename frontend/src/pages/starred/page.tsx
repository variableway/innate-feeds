import { useNavigate, useParams } from "@tanstack/react-router";
import type { FeedFilters, FeedItem } from "@/types/feed";
import { useFeedList } from "@/hooks/use-feed-list";
import { FeedListPage } from "@/components/feed-list-page";

const DEFAULT_FILTERS: FeedFilters = {
  sort: "stars",
  order: "desc",
};

export function StarredPage() {
  const params = useParams({ strict: false }) as { repoId?: string };
  const navigate = useNavigate();
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

  const openDetail = (item: FeedItem) => {
    void navigate({
      to: "/starred/$repoId",
      params: { repoId: String(item.repo.id) },
    });
  };

  const closeDetail = () => {
    void navigate({ to: "/starred" });
  };

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
      selectedRepoId={params.repoId ?? null}
      emptyMessage="No starred repositories found."
      onFiltersChange={handleFiltersChange}
      onTopicClick={handleTopicClick}
      onPageChange={setPage}
      onSelectItem={openDetail}
      onCloseDetail={closeDetail}
    />
  );
}
