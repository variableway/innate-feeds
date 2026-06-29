import * as React from "react";
import { TrendingUp, Star, GitFork } from "lucide-react";
import type { FeedStats } from "@/types/feed";
import { formatNumber, cn } from "@/lib/utils";

interface StatsCardsProps extends React.HTMLAttributes<HTMLDivElement> {
  stats: FeedStats | null;
  loading: boolean;
}

/**
 * StatsCards component following fe-foundation skill patterns
 */
const StatsCards = React.forwardRef<HTMLDivElement, StatsCardsProps>(
  ({ stats, loading, className, ...props }, ref) => {
    if (loading || !stats) {
      return (
        <div
          ref={ref}
          className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3", className)}
          {...props}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-4 animate-pulse"
            >
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="mt-2 h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      );
    }

    const cards = [
      {
        title: "Total Repos",
        value: stats.totalRepos,
        icon: GitFork,
      },
      {
        title: "Trending",
        value: stats.trendingCount,
        icon: TrendingUp,
      },
      {
        title: "Starred",
        value: stats.starredCount,
        icon: Star,
      },
    ];

    return (
      <div
        ref={ref}
        className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3", className)}
        {...props}
      >
        {cards.map((card) => (
          <div key={card.title} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <card.icon className="h-4 w-4" />
              {card.title}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {formatNumber(card.value)}
            </div>
          </div>
        ))}
      </div>
    );
  },
);
StatsCards.displayName = "StatsCards";

export { StatsCards };
