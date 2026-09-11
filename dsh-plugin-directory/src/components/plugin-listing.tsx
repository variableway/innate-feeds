import { PluginCategoryFilter } from "@/components/filters/plugin-category-filter"
import { PluginPagination } from "@/components/filters/plugin-pagination"
import { PluginSearch } from "@/components/filters/plugin-search"
import { PluginSort } from "@/components/filters/plugin-sort"
import { ClearFiltersButton } from "@/components/filters/clear-filters-button"
import { ViewToggle } from "@/components/filters/view-toggle"
import { PluginCard } from "@/components/plugin-card"
import { PluginListItem } from "@/components/plugin-list-item"
import type { PluginWithCategory } from "@/server/plugins/queries"

interface PluginListingProps {
  plugins: PluginWithCategory[]
  total: number
  pageCount: number
  /** "grid" (cards) or "list" (rows). */
  view: "grid" | "list"
  /** Hide the category multi-filter (e.g. on a single-category page). */
  hideCategoryFilter?: boolean
  /** Category ids kept when clearing filters. */
  lockedCategory?: string[]
}

export function PluginListing({
  plugins,
  total,
  pageCount,
  view,
  hideCategoryFilter,
  lockedCategory,
}: PluginListingProps) {
  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <PluginSearch />
          {!hideCategoryFilter ? <PluginCategoryFilter /> : null}
        </div>
        <div className="flex items-center gap-3">
          <PluginSort />
          <ViewToggle />
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {total} {total === 1 ? "plugin" : "plugins"}
      </p>

      {plugins.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No plugins match.</p>
          <ClearFiltersButton keepCategory={lockedCategory} />
        </div>
      ) : view === "list" ? (
        <div className="flex flex-col gap-2">
          {plugins.map((plugin) => (
            <PluginListItem key={plugin.id} plugin={plugin} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      )}

      <PluginPagination pageCount={pageCount} />
    </section>
  )
}
