import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { TrendingUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedStats } from "@/types/feed";

interface CategoryPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  stats: FeedStats | null;
  loading?: boolean;
}

interface CategoryItem {
  id: "trending" | "starred";
  title: string;
  href: string;
  icon: React.ElementType;
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
      },
      {
        id: "starred",
        title: "Starred",
        href: "/starred",
        icon: Star,
      },
    ];

    return (
      <div
        ref={ref}
        className={cn(
          "app-panel flex h-full w-44 flex-col border-r",
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
                const isActive = currentPath.startsWith(category.href);
                return (
                  <Link
                    key={category.id}
                    to={category.href}
                    className={cn(
                      "flex items-center rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <category.icon className="h-4 w-4" />
                      <span className="font-medium">{category.title}</span>
                    </div>
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
