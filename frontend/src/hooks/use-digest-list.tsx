import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { DigestFeedItem, DigestFilters } from "@/types/feed";
import { fetchDigestFeeds } from "@/services/feeds";
import { hideItem, unhideItem } from "@/services/hidden";
import { usePageSize } from "@/hooks/use-page-size";
import { toast } from "sonner";

const DEFAULT_FILTERS: DigestFilters = { sort: "created", order: "desc" };

interface DigestFiltersContextValue {
  filters: DigestFilters;
  categories: string[];
  sources: {
    id: "ruanyf-weekly" | "github-daily";
    repo: string;
    count: number;
  }[];
  loadingMeta: boolean;
  setFilters: (next: DigestFilters) => void;
}

const DigestFiltersContext = createContext<DigestFiltersContextValue | null>(
  null,
);

export function DigestFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<DigestFilters>(DEFAULT_FILTERS);
  const [categories, setCategories] = useState<string[]>([]);
  const [sources, setSources] = useState<DigestFiltersContextValue["sources"]>(
    [],
  );
  const [loadingMeta, setLoadingMeta] = useState(true);

  const setFilters = useCallback((next: DigestFilters) => {
    setFiltersState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    fetchDigestFeeds({}, 1, 1)
      .then((res) => {
        if (cancelled) return;
        setCategories(res.categories);
        setSources(res.sources);
      })
      .catch(() => {
        if (!cancelled) {
          setCategories([]);
          setSources([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DigestFiltersContext.Provider
      value={{ filters, categories, sources, loadingMeta, setFilters }}
    >
      {children}
    </DigestFiltersContext.Provider>
  );
}

export function useDigestFilters(): DigestFiltersContextValue {
  const ctx = useContext(DigestFiltersContext);
  if (!ctx) {
    throw new Error(
      "useDigestFilters must be used within DigestFiltersProvider",
    );
  }
  return ctx;
}

export function useDigestList() {
  const { filters, setFilters, categories, sources, loadingMeta } =
    useDigestFilters();
  const [items, setItems] = useState<DigestFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null | undefined>(
    undefined,
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = usePageSize();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDigestFeeds(filters, page, pageSize);
      setItems(res.items);
      setTotal(res.total);
      setFetchedAt(res.fetchedAt);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load digest";
      toast.error(message);
      setError(message);
      setItems([]);
      setTotal(0);
      setFetchedAt(undefined);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const handleFiltersChange = (next: DigestFilters) => {
    setFilters(next);
  };

  const handlePageSizeChange = (next: number) => {
    setPage(1);
    setPageSize(next);
  };

  const handleHideItem = (item: DigestFeedItem) => {
    void hideItem("digest", item.id).then(() => loadData());
    toast.success(`Hidden "${item.title}"`, {
      action: {
        label: "Undo",
        onClick: () =>
          void unhideItem("digest", item.id).then(() => loadData()),
      },
    });
  };

  return {
    items,
    filters,
    categories,
    sources,
    loading: loading || loadingMeta,
    error,
    fetchedAt: fetchedAt === undefined ? null : fetchedAt,
    page,
    total,
    pageSize,
    setPage,
    handleFiltersChange,
    handlePageSizeChange,
    handleHideItem,
  };
}
