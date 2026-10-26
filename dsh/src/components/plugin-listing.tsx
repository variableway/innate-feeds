import { Link } from "@tanstack/react-router";
import { PLUGIN_CATEGORIES } from "@innate/shared/plugin-categories";
import type { DshPlugin } from "@/types/plugin";
import { PluginCard } from "@/components/plugin-card";
import { PluginListItem } from "@/components/plugin-list-item";

export interface PluginListingSearch {
  q: string;
  category: string;
  sort: string;
  view: "grid" | "list";
  page: number;
}

interface PluginListingProps {
  plugins: DshPlugin[];
  total: number;
  pageCount: number;
  search: PluginListingSearch;
  hideCategoryFilter?: boolean;
  lockedCategory?: string;
  onChange: (next: Partial<PluginListingSearch>) => void;
}

export function PluginListing({
  plugins,
  total,
  pageCount,
  search,
  hideCategoryFilter,
  lockedCategory,
  onChange,
}: PluginListingProps) {
  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search.q}
            onChange={(event) => onChange({ q: event.target.value, page: 1 })}
            placeholder="Search plugins"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
          />
          {!hideCategoryFilter ? (
            <select
              value={search.category}
              onChange={(event) =>
                onChange({ category: event.target.value, page: 1 })
              }
              className="h-9 rounded-md border bg-background px-2 text-sm"
              aria-label="Category"
            >
              <option value="">All categories</option>
              {PLUGIN_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={search.sort}
            onChange={(event) =>
              onChange({ sort: event.target.value, page: 1 })
            }
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="Sort"
          >
            <option value="stars.desc">Stars ↓</option>
            <option value="stars.asc">Stars ↑</option>
            <option value="added.desc">Added ↓</option>
            <option value="added.asc">Added ↑</option>
            <option value="name.asc">Name A–Z</option>
            <option value="name.desc">Name Z–A</option>
          </select>
          <select
            value={search.view}
            onChange={(event) =>
              onChange({ view: event.target.value as "grid" | "list" })
            }
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="View"
          >
            <option value="grid">Grid</option>
            <option value="list">List</option>
          </select>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {total} {total === 1 ? "plugin" : "plugins"}
      </p>

      {plugins.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No plugins match.</p>
          <button
            type="button"
            onClick={() =>
              onChange({
                q: "",
                category: lockedCategory ?? "",
                sort: "stars.desc",
                page: 1,
              })
            }
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : search.view === "list" ? (
        <div className="flex flex-col gap-2">
          {plugins.map((plugin) => (
            <PluginListItem key={plugin.slug} plugin={plugin} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <PluginCard key={plugin.slug} plugin={plugin} />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={search.page <= 1}
            onClick={() => onChange({ page: search.page - 1 })}
            className="rounded-md border px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {search.page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={search.page >= pageCount}
            onClick={() => onChange({ page: search.page + 1 })}
            className="rounded-md border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/dsh/categories" className="hover:text-foreground">
          Browse all categories
        </Link>
      </p>
    </section>
  );
}
