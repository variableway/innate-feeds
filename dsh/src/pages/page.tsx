import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { fetchPluginStats, fetchPlugins } from "@/services/plugins";
import {
  PluginListing,
  type PluginListingSearch,
} from "@/components/plugin-listing";
import type { DshPlugin, PluginStats } from "@/types/plugin";
import type { DshSearch } from "@/types/dsh";

export function DshPluginsPage() {
  // 路由挂在 pathless layout 下，`from: "/dsh"` 匹配不到；用 strict:false + 显式类型
  const search = useSearch({ strict: false }) as DshSearch;
  const navigate = useNavigate();
  const [stats, setStats] = useState<PluginStats | null>(null);
  const [plugins, setPlugins] = useState<DshPlugin[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPluginStats()
      .then(setStats)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchPlugins({
      q: search.q,
      category: search.category,
      sort: search.sort ?? "stars.desc",
      page: search.page ?? 1,
    })
      .then((result) => {
        if (cancelled) return;
        setPlugins(result.items);
        setTotal(result.total);
        setPageCount(result.pageCount);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [search.q, search.category, search.sort, search.page]);

  const listingSearch: PluginListingSearch = {
    q: search.q ?? "",
    category: search.category ?? "",
    sort: search.sort ?? "stars.desc",
    view: search.view ?? "grid",
    page: search.page ?? 1,
  };

  const onChange = (next: Partial<PluginListingSearch>) => {
    void navigate({
      // 路由 id 含 pathless layout，search 泛型推不出；显式 DshSearch 合并
      search: ((prev: DshSearch) => ({
        ...prev,
        ...next,
      })) as unknown as true,
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <section className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Awesome DSH Plugins
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          A curated list of DeepSeek Harness (dsh) plugins
        </p>
        {stats ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total} plugins across {stats.categories} categories
          </p>
        ) : null}
      </section>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <PluginListing
        plugins={plugins}
        total={total}
        pageCount={pageCount}
        search={listingSearch}
        onChange={onChange}
      />
    </div>
  );
}
