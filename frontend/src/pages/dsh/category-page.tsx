import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { pluginCategoryById } from "@innate/shared/plugin-categories";
import { fetchPlugins } from "@/services/plugins";
import {
  PluginListing,
  type PluginListingSearch,
} from "@/components/plugin-listing";
import type { DshPlugin } from "@/types/plugin";

export function DshCategoryPage() {
  const { slug } = useParams({ from: "/dsh/categories/$slug" });
  const search = useSearch({ from: "/dsh/categories/$slug" });
  const navigate = useNavigate({ from: "/dsh/categories/$slug" });
  const category = pluginCategoryById(slug);
  const [plugins, setPlugins] = useState<DshPlugin[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    let cancelled = false;
    void fetchPlugins({
      q: search.q,
      category: slug,
      sort: search.sort ?? "stars.desc",
      page: search.page ?? 1,
    }).then((result) => {
      if (cancelled) return;
      setPlugins(result.items);
      setTotal(result.total);
      setPageCount(result.pageCount);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, search.q, search.sort, search.page]);

  const listingSearch: PluginListingSearch = {
    q: search.q ?? "",
    category: slug,
    sort: search.sort ?? "stars.desc",
    view: search.view ?? "grid",
    page: search.page ?? 1,
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Link
        to="/dsh/categories"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Categories
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        {category ? `${category.emoji} ${category.label}` : slug}
      </h1>
      {category ? (
        <p className="mt-2 text-muted-foreground">{category.labelZh}</p>
      ) : null}
      <div className="mt-8">
        <PluginListing
          plugins={plugins}
          total={total}
          pageCount={pageCount}
          search={listingSearch}
          hideCategoryFilter
          lockedCategory={slug}
          onChange={(next) => {
            void navigate({
              search: (prev) => ({ ...prev, ...next }),
            });
          }}
        />
      </div>
    </div>
  );
}
