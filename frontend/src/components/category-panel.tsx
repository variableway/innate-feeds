import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { TrendingUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedStats } from "@/types/feed";
import { formatNumber } from "@/lib/utils";

interface CategoryPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  stats: FeedStats | null;
  loading?: boolean;
}

interface CategoryItem {
  id: "trending" | "starred";
  title: string;
  href: string;
  icon: React.ElementType;
  count: number;
}

const CategoryPanel = React.forwardRef<HTMLDivElement, CategoryPanelProps>(
  ({ stats, loading = false, className, ...props }, ref) => {
    const router = useRouterState();
    const currentPath = router.location.pathname;

    const categories: CategoryItem[] = [
      {
        id: "trending",
        title: "Trending",
        href: "/trending",
        icon: TrendingUp,
        count: stats?.trendingCount || 0,
      },
      {
        id: "starred",
        title: "Starred",
        href: "/starred",
        icon: Star,
        count: stats?.starredCount || 0,
      },
    ];

    return (
      <div
        ref={ref}
        className={cn(
          "app-panel flex h-full w-64 flex-col border-r",
          className,
        )}
        {...props}
      >
        <div className="flex h-14 items-center border-b px-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-md border bg-background px-3"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {categories.map((category) => {
                const isActive = currentPath === category.href;
                return (
                  <Link
                    key={category.id}
                    to={category.href}
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <category.icon className="h-4 w-4" />
                      <span className="font-medium">{category.title}</span>
                    </div>
                    <span className="text-xs opacity-80">
                      {formatNumber(category.count)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  },
);
CategoryPanel.displayName = "CategoryPanel";

export { CategoryPanel };
