import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TRENDSHIFT_LANGUAGES,
  TRENDSHIFT_LANGUAGE_LABELS,
  TRENDSHIFT_SORT_LABELS,
  TRENDSHIFT_TIMEFRAMES,
  TRENDSHIFT_TIMEFRAME_LABELS,
  type TrendshiftLanguageFilter,
  type TrendshiftSort,
  type TrendshiftTimeframe,
} from "@/types/trendshift";

interface TrendshiftToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  timeframe: TrendshiftTimeframe;
  language: TrendshiftLanguageFilter;
  sort: TrendshiftSort;
  search: string;
  onTimeframeChange: (timeframe: TrendshiftTimeframe) => void;
  onLanguageChange: (language: TrendshiftLanguageFilter) => void;
  onSortChange: (sort: TrendshiftSort) => void;
  onSearchChange: (search: string) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

const TrendshiftToolbar = React.forwardRef<
  HTMLDivElement,
  TrendshiftToolbarProps
>(
  (
    {
      timeframe,
      language,
      sort,
      search,
      onTimeframeChange,
      onLanguageChange,
      onSortChange,
      onSearchChange,
      className,
      ...props
    },
    ref,
  ) => {
    const [searchInput, setSearchInput] = React.useState(search);
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

    React.useEffect(() => {
      setSearchInput(search);
    }, [search]);

    React.useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    const handleSearchInput = (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, SEARCH_DEBOUNCE_MS);
    };

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-3", className)}
        {...props}
      >
        <div
          role="tablist"
          aria-label="Trendshift timeframes"
          className="flex items-center gap-1 border-b"
        >
          {TRENDSHIFT_TIMEFRAMES.map((tf) => {
            const isActive = tf === timeframe;
            return (
              <button
                key={tf}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTimeframeChange(tf)}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {TRENDSHIFT_TIMEFRAME_LABELS[tf]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchInput("");
                  onSearchChange("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            aria-label="Language filter"
            value={language}
            onChange={(e) =>
              onLanguageChange(e.target.value as TrendshiftLanguageFilter)
            }
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TRENDSHIFT_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {TRENDSHIFT_LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort order"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as TrendshiftSort)}
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(Object.keys(TRENDSHIFT_SORT_LABELS) as TrendshiftSort[]).map(
              (key) => (
                <option key={key} value={key}>
                  {TRENDSHIFT_SORT_LABELS[key]}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
    );
  },
);
TrendshiftToolbar.displayName = "TrendshiftToolbar";

export { TrendshiftToolbar };
