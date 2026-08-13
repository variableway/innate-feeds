import * as React from "react";
import { Search, X } from "lucide-react";
import type { DigestFilters, DigestSourceId } from "@/types/feed";
import { cn } from "@/lib/utils";

interface DigestFilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  filters: DigestFilters;
  categories: string[];
  onFiltersChange: (filters: DigestFilters) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

const SOURCE_OPTIONS: { value: DigestSourceId | ""; label: string }[] = [
  { value: "", label: "All sources" },
  { value: "ruanyf-weekly", label: "ruanyf/weekly" },
  { value: "github-daily", label: "GitHubDaily" },
];

const SORT_OPTIONS: { value: NonNullable<DigestFilters["sort"]>; label: string }[] =
  [
    { value: "created", label: "Created" },
    { value: "updated", label: "Updated" },
    { value: "comments", label: "Comments" },
  ];

function categoryLabel(cat: string): string {
  return cat === "__uncategorized__" ? "未分类" : cat;
}

const DigestFilterBar = React.forwardRef<HTMLDivElement, DigestFilterBarProps>(
  ({ filters, categories, onFiltersChange, className, ...props }, ref) => {
    const [searchInput, setSearchInput] = React.useState(filters.search || "");
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

    React.useEffect(() => {
      setSearchInput(filters.search || "");
    }, [filters.search]);

    React.useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

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

    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center gap-3", className)}
        {...props}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search digest…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <select
          value={filters.source || ""}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              source: (e.target.value || undefined) as
                | DigestSourceId
                | undefined,
            })
          }
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filters.category || ""}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              category: e.target.value || undefined,
            })
          }
          className="max-w-[12rem] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabel(cat)}
            </option>
          ))}
        </select>

        <select
          value={filters.sort || "created"}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              sort: e.target.value as DigestFilters["sort"],
              order: "desc",
            })
          }
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(filters.hasPrimaryUrl)}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                hasPrimaryUrl: e.target.checked || undefined,
              })
            }
            className="rounded border"
          />
          Has link
        </label>
      </div>
    );
  },
);
DigestFilterBar.displayName = "DigestFilterBar";

export { DigestFilterBar };
