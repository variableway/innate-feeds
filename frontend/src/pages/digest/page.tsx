import { useNavigate, useParams } from "@tanstack/react-router";
import { useDigestList } from "@/hooks/use-digest-list";
import { DigestCard } from "@/components/digest-card";
import { DigestDetailPane } from "@/components/digest-detail-pane";
import { DigestFilterBar } from "@/components/digest-filter-bar";
import { MasterDetailLayout } from "@/components/master-detail-layout";
import { PageSizeSelect } from "@/components/page-size-select";
import type { DigestFeedItem } from "@/types/feed";

export function DigestPage() {
  const params = useParams({ strict: false }) as { digestId?: string };
  const digestId = params.digestId;
  const navigate = useNavigate();
  const {
    items,
    filters,
    categories,
    loading,
    error,
    fetchedAt,
    page,
    total,
    pageSize,
    setPage,
    handleFiltersChange,
    handlePageSizeChange,
    handleHideItem,
  } = useDigestList();

  const selected = digestId
    ? (items.find((i) => i.id === digestId) ?? null)
    : null;

  const openDetail = (item: DigestFeedItem) => {
    void navigate({
      to: "/digest/$digestId",
      params: { digestId: item.id },
    });
  };

  const closeDetail = () => {
    void navigate({ to: "/digest" });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.source ||
    filters.category ||
    filters.hasPrimaryUrl,
  );

  const filterBar = (
    <DigestFilterBar
      className="mb-4"
      filters={filters}
      categories={categories}
      onFiltersChange={handleFiltersChange}
    />
  );

  const emptyMessage = (() => {
    if (error) {
      return (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Could not load digest from GitHub.
          <div className="mt-2 text-xs">{error}</div>
        </div>
      );
    }
    if (hasActiveFilters) {
      return (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          No digest items match these filters.
        </div>
      );
    }
    if (fetchedAt === null) {
      return (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No digest items found. Issues are loaded live from GitHub
          (ruanyf/weekly and GitHubDaily/GitHubDaily).
        </div>
      );
    }
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No digest items match these filters.
      </div>
    );
  })();

  const pagination =
    total > 0 ? (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 pb-2">
        {total > pageSize && (
          <>
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Previous
            </button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </>
        )}
        <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} />
      </div>
    ) : null;

  if (digestId) {
    return (
      <MasterDetailLayout
        className="h-[calc(100vh-3.5rem)]"
        list={
          <div className="space-y-2 p-3">
            {filterBar}
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-lg border bg-card"
                  />
                ))
              : items.length === 0
                ? emptyMessage
                : items.map((item) => (
                    <DigestCard
                      key={item.id}
                      item={item}
                      compact
                      selected={item.id === digestId}
                      onItemSelect={openDetail}
                      onHide={handleHideItem}
                    />
                  ))}
            {pagination}
          </div>
        }
        detail={
          <DigestDetailPane
            digestId={digestId}
            preview={selected}
            onClose={closeDetail}
          />
        }
      />
    );
  }

  return (
    <div className="p-6">
      {filterBar}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        emptyMessage
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <DigestCard
              key={item.id}
              item={item}
              className="h-full"
              onItemSelect={openDetail}
              onHide={handleHideItem}
            />
          ))}
        </div>
      )}
      {pagination}
    </div>
  );
}
