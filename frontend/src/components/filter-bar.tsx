import * as React from "react";
import { Search, X } from "lucide-react";
import type { FeedFilters } from "@/types/feed";
import { cn } from "@/lib/utils";

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  filters: FeedFilters;
  languages: string[];
  dates: string[];
  onFiltersChange: (filters: FeedFilters) => void;
  showStarsRange?: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  (
    { filters, languages, dates, onFiltersChange, showStarsRange = false, className, ...props },
    ref,
  ) => {
    const [searchInput, setSearchInput] = React.useState(filters.search || "");

    // Sync external search value when filters.search changes externally (e.g. cleared).
    React.useEffect(() => {
      setSearchInput(filters.search || "");
    }, [filters.search]);

    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value || undefined });
      }, SEARCH_DEBOUNCE_MS);
    };

    const clearSearch = () => {
      setSearchInput("");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onFiltersChange({ ...filters, search: undefined });
    };

    React.useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    const updateFilter = (
      key: keyof FeedFilters,
      value: string | undefined,
    ) => {
      onFiltersChange({ ...filters, [key]: value || undefined });
    };

    const updateStarsRange = (key: "starsMin" | "starsMax", raw: string) => {
      const parsed = raw.trim() === "" ? undefined : Number(raw);
      const value =
        parsed === undefined || Number.isNaN(parsed) ? undefined : parsed;
      onFiltersChange({ ...filters, [key]: value });
    };

    const removeTopic = (topic: string) => {
      const next = (filters.topics ?? []).filter((t) => t !== topic);
      onFiltersChange({ ...filters, topics: next.length ? next : undefined });
    };

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
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

        {showStarsRange && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              placeholder="Min stars"
              value={filters.starsMin ?? ""}
              onChange={(e) => updateStarsRange("starsMin", e.target.value)}
              className="w-[110px] rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">-</span>
            <input
              type="number"
              min={0}
              placeholder="Max stars"
              value={filters.starsMax ?? ""}
              onChange={(e) => updateStarsRange("starsMax", e.target.value)}
              className="w-[110px] rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        </div>

        {filters.topics && filters.topics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Topics:</span>
            {filters.topics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => removeTopic(topic)}
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/25"
              >
                {topic}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, topics: undefined })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    );
  },
);
FilterBar.displayName = "FilterBar";

export { FilterBar };
