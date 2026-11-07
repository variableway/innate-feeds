import type { FeedItem, FeedFilters } from "@/types/feed";
import { FeedCard } from "@/components/feed-card";
import { HotBoard } from "@/components/hot-board";
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
  /** sprint-3 B4：前 10 项渲染为 AIHot 热点榜三层结构，其余进网格 */
  hotBoard?: boolean;
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
  hotBoard = false,
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

  const listItems = hotBoard && !loading ? items.slice(10) : items;
  const board = hotBoard && !loading && items.length > 0 ? (
    <HotBoard items={items.slice(0, 10)} selectedRepoId={selectedRepoId} onSelectItem={onSelectItem} />
  ) : null;

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
    if (listItems.length === 0 && !board) {
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
    return listItems.map((item) => (
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
            {board}
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
      {board}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {listBody}
      </div>
      {pagination}
    </div>
  );
}
