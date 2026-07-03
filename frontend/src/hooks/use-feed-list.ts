import { useState, useEffect, useCallback } from "react";
import type { FeedItem, FeedFilters } from "@/types/feed";
import { toggleTopicFilter } from "@/types/feed";
import { fetchFeeds, fetchLanguages, fetchDates } from "@/services/feeds";
import { usePersistedFeedFilters } from "@/hooks/use-persisted-feed-filters";
import { toast } from "sonner";

export function useFeedList(
  feedType: "trending" | "starred",
  defaultFilters: FeedFilters,
  pageSize = 20,
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
      setItems(feedRes.items);
      setTotal(feedRes.total);
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
  };
}
