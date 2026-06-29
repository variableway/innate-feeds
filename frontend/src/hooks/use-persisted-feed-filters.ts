import { useCallback, useEffect, useState } from "react";
import type { FeedFilters } from "@/types/feed";
import {
  loadPersistedFeedFilters,
  savePersistedFeedFilters,
} from "@/lib/feed-filters-storage";

export function usePersistedFeedFilters(
  feedType: "trending" | "starred",
  defaults: FeedFilters,
): [FeedFilters, (next: FeedFilters) => void] {
  const [filters, setFiltersState] = useState<FeedFilters>(() =>
    loadPersistedFeedFilters(feedType, defaults),
  );

  useEffect(() => {
    savePersistedFeedFilters(feedType, filters);
  }, [feedType, filters]);

  const setFilters = useCallback((next: FeedFilters) => {
    setFiltersState(next);
  }, []);

  return [filters, setFilters];
}
