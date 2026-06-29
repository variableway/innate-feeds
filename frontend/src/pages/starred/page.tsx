import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import type { FeedItem, FeedFilters } from "@/types/feed";
import {
  fetchFeeds,
  fetchLanguages,
  syncFeeds,
  isStaticMode,
} from "@/services/feeds";
import { FeedCard } from "@/components/feed-card";
import { FilterBar } from "@/components/filter-bar";
import { toast } from "sonner";

export function StarredPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [filters, setFilters] = useState<FeedFilters>({
    sort: "starred",
    order: "desc",
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncFeeds("starred");
      toast.success(`Synced ${result.synced} starred repositories`);
      await loadData();
    } catch (err) {
      toast.error("Failed to sync starred feeds");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FilterBar
          filters={filters}
          languages={languages}
          dates={[]}
          onFiltersChange={setFilters}
          className="flex-1"
        />
        {!isStaticMode() && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Starred"}
          </button>
        )}
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
            {!isStaticMode() &&
              ' Click "Sync Starred" to fetch your starred repos.'}
          </div>
        ) : (
          items.map((item) => <FeedCard key={item.id} item={item} />)
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
