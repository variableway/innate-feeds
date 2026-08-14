import type { FeedItem, FeedFilters } from "@/types/feed";
import { FeedCard } from "@/components/feed-card";
import { FilterBar } from "@/components/filter-bar";
import { GitHubProductTabs } from "@/components/github-product-tabs";
import { MasterDetailLayout } from "@/components/master-detail-layout";
import { PageSizeSelect } from "@/components/page-size-select";
import { RepoDetailPane } from "@/components/repo-detail-pane";

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
  selectedRepoId?: string | null;
  onFiltersChange: (filters: FeedFilters) => void;
  onTopicClick: (topic: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectItem?: (item: FeedItem) => void;
  onHideItem?: (item: FeedItem) => void;
  onCloseDetail?: () => void;
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
  selectedRepoId,
  onFiltersChange,
  onTopicClick,
  onPageChange,
  onPageSizeChange,
  onSelectItem,
  onHideItem,
  onCloseDetail,
}: FeedListPageProps) {
  const totalPages = Math.ceil(total / pageSize);
  const selectedItem =
    selectedRepoId != null
      ? (items.find(
          (item) =>
            item.id === selectedRepoId ||
            String(item.repo.id) === selectedRepoId ||
            item.repo.fullName === decodeURIComponent(selectedRepoId),
        ) ?? null)
      : null;

  const productTabs = (
    <GitHubProductTabs className={selectedRepoId ? "mb-3" : "mb-4"} />
  );

  const filterBar = (
    <div className={selectedRepoId ? "mb-3" : "mb-6"}>
      <FilterBar
        filters={filters}
        languages={languages}
        dates={dates}
        showStarsRange={showStarsRange}
        onFiltersChange={onFiltersChange}
      />
    </div>
  );

  const isDetail = Boolean(selectedRepoId);

  const listBody = (() => {
    if (loading) {
      return Array.from({ length: isDetail ? 5 : 6 }).map((_, i) => (
        <div
          key={i}
          className={
            isDetail
              ? "h-24 animate-pulse rounded-lg border bg-card"
              : "h-40 animate-pulse rounded-lg border bg-card"
          }
        />
      ));
    }
    if (items.length === 0) {
      return (
        <div
          className={
            isDetail
              ? "rounded-lg border bg-card p-8 text-center text-muted-foreground"
              : "col-span-full rounded-lg border bg-card p-8 text-center text-muted-foreground"
          }
        >
          {emptyMessage}
        </div>
      );
    }
    return items.map((item) => (
      <FeedCard
        key={item.id}
        item={item}
        className={isDetail ? undefined : "h-full"}
        compact={isDetail}
        selected={
          selectedRepoId != null &&
          (item.id === selectedRepoId ||
            String(item.repo.id) === selectedRepoId ||
            item.repo.fullName === decodeURIComponent(selectedRepoId))
        }
        selectedTopics={filters.topics}
        onTopicClick={onTopicClick}
        onItemSelect={onSelectItem}
        onHide={onHideItem}
      />
    ));
  })();

  const pagination =
    total > 0 ? (
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {total > pageSize && (
          <>
            <button
              type="button"
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
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </>
        )}
        <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
      </div>
    ) : null;

  if (selectedRepoId && onCloseDetail) {
    return (
      <MasterDetailLayout
        className="h-[calc(100vh-3.5rem)] w-full"
        list={
          <div className="space-y-2 p-3">
            {productTabs}
            {filterBar}
            <div className="space-y-2">{listBody}</div>
            {pagination}
          </div>
        }
        detail={
          selectedItem ? (
            <RepoDetailPane item={selectedItem} onClose={onCloseDetail} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : "Repository not on this page. Close and pick another, or change filters."}
              <button
                type="button"
                onClick={onCloseDetail}
                className="ml-3 rounded-md border px-2 py-1 text-xs hover:bg-accent"
              >
                Close
              </button>
            </div>
          )
        }
      />
    );
  }

  return (
    <div className="p-6">
      {productTabs}
      {filterBar}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {listBody}
      </div>
      {pagination}
    </div>
  );
}
