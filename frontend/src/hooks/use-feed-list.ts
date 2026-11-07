import { useState, useEffect, useCallback } from "react";
import type { FeedItem, FeedFilters } from "@/types/feed";
import { toggleTopicFilter } from "@/types/feed";
import { fetchFeeds, fetchLanguages, fetchDates } from "@/services/feeds";
import { hideItem, unhideItem } from "@/services/hidden";
import { usePersistedFeedFilters } from "@/hooks/use-persisted-feed-filters";
import { usePageSize } from "@/hooks/use-page-size";
import { toast } from "sonner";

export function useFeedList(
  feedType: "trending" | "starred",
  defaultFilters: FeedFilters,
) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [filters, setFilters] = usePersistedFeedFilters(
    feedType,
    defaultFilters,
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = usePageSize();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const requests: Promise<unknown>[] = [
        fetchFeeds(feedType, filters, page, pageSize),
        fetchLanguages(),
      ];
      if (feedType === "trending") {
        requests.push(fetchDates());
      }
      const results = await Promise.all(requests);
      const feedRes = results[0] as { items: FeedItem[]; total: number };
      const langsRes = results[1] as string[];
      // sprint-3 B15 修复：trending 无 date 筛选时，同一仓库会以多个快照日
      // 重复出现（如 11/05 与 11/06 同时在榜）。按 repo 去重，保留最新快照。
      let listItems = feedRes.items;
      if (feedType === "trending" && !filters.date) {
        const byRepo = new Map<string, FeedItem>();
        for (const item of listItems) {
          const key = item.repo.fullName;
          const prev = byRepo.get(key);
          const newer =
            !prev ||
            (item.snapshotDate ?? "") > (prev.snapshotDate ?? "");
          if (newer) byRepo.set(key, item);
        }
        listItems = [...byRepo.values()];
      }
      setItems(listItems);
      setTotal(
        listItems.length === feedRes.items.length
          ? feedRes.total
          : feedRes.total - (feedRes.items.length - listItems.length),
      );
      setLanguages(langsRes);
      if (feedType === "trending") {
        setDates(results[2] as string[]);
      }
    } catch {
      toast.error(`Failed to load ${feedType} feeds`);
    } finally {
      setLoading(false);
    }
  }, [feedType, filters, page, pageSize]);

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

  const handlePageSizeChange = (next: number) => {
    setPage(1);
    setPageSize(next);
  };

  const handleHideItem = (item: FeedItem) => {
    const fullName = item.repo.fullName;
    void hideItem("repo", fullName).then(() => loadData());
    toast.success(`Hidden ${fullName}`, {
      action: {
        label: "Undo",
        onClick: () => void unhideItem("repo", fullName).then(() => loadData()),
      },
    });
  };

  return {
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
    handlePageSizeChange,
    handleHideItem,
  };
}
