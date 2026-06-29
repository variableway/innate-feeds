import * as React from "react";
import { Search, X } from "lucide-react";
import type { FeedFilters } from "@/types/feed";
import { cn } from "@/lib/utils";

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  filters: FeedFilters;
  languages: string[];
  dates: string[];
  onFiltersChange: (filters: FeedFilters) => void;
}

/**
 * FilterBar - simplified with date filter for trending
 */
const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  (
    { filters, languages, dates, onFiltersChange, className, ...props },
    ref,
  ) => {
    const updateFilter = (
      key: keyof FeedFilters,
      value: string | undefined,
    ) => {
      onFiltersChange({ ...filters, [key]: value || undefined });
    };

    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center gap-3", className)}
        {...props}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter("search", undefined)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={filters.language || ""}
          onChange={(e) => updateFilter("language", e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Languages</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        {dates.length > 0 && (
          <select
            value={filters.date || ""}
            onChange={(e) => updateFilter("date", e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Latest</option>
            {dates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          placeholder="Filter by topic..."
          value={filters.topic || ""}
          onChange={(e) => updateFilter("topic", e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-[150px]"
        />

        <select
          value={filters.sort || "stars"}
          onChange={(e) =>
            updateFilter("sort", e.target.value as FeedFilters["sort"])
          }
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="stars">Stars</option>
          <option value="updated">Updated</option>
          <option value="created">Created</option>
          <option value="starred">Starred Time</option>
        </select>
      </div>
    );
  },
);
FilterBar.displayName = "FilterBar";

export { FilterBar };
