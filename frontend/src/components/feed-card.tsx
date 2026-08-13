import * as React from "react";
import { Star, GitFork, ExternalLink } from "lucide-react";
import type { FeedItem } from "@/types/feed";
import { formatNumber, cn } from "@/lib/utils";

interface FeedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  item: FeedItem;
  selectedTopics?: string[];
  onTopicClick?: (topic: string) => void;
  compact?: boolean;
  selected?: boolean;
  onItemSelect?: (item: FeedItem) => void;
}

/**
 * FeedCard - simplified, no period tags
 */
const FeedCard = React.forwardRef<HTMLDivElement, FeedCardProps>(
  (
    {
      item,
      selectedTopics,
      onTopicClick,
      compact = false,
      selected = false,
      onItemSelect,
      className,
      ...props
    },
    ref,
  ) => {
    const { repo } = item;

    return (
      <div
        ref={ref}
        role={onItemSelect ? "button" : undefined}
        tabIndex={onItemSelect ? 0 : undefined}
        onClick={onItemSelect ? () => onItemSelect(item) : undefined}
        onKeyDown={
          onItemSelect
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onItemSelect(item);
                }
              }
            : undefined
        }
        className={cn(
          "group flex h-full flex-col rounded-lg border bg-card transition-colors",
          onItemSelect && "cursor-pointer hover:bg-accent",
          selected && "border-primary bg-accent/60 ring-1 ring-primary/30",
          compact ? "p-3" : "p-4",
          className,
        )}
        {...props}
      >
        <div className="flex min-h-0 flex-1 items-start gap-3">
          <a
            href={repo.owner.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <img
              src={repo.owner.avatarUrl}
              alt={repo.owner.login}
              className={cn("rounded-full", compact ? "h-8 w-8" : "h-10 w-10")}
            />
          </a>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "truncate font-semibold text-foreground",
                  onItemSelect && "group-hover:underline",
                )}
              >
                {repo.fullName}
              </span>
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="Open on GitHub"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            {repo.description && (
              <p
                className={cn(
                  "mt-1 text-sm text-muted-foreground",
                  compact ? "line-clamp-1" : "line-clamp-3",
                )}
              >
                {repo.description}
              </p>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground">
              {repo.language && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  {repo.language}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5" />
                {formatNumber(repo.stars)}
              </span>
              {!compact && (
                <span className="inline-flex items-center gap-1">
                  <GitFork className="h-3.5 w-3.5" />
                  {formatNumber(repo.forks)}
                </span>
              )}
            </div>
            {!compact && repo.topics.length > 0 && (
              <div className="mt-2 flex max-h-14 flex-wrap gap-1 overflow-hidden">
                {repo.topics.slice(0, 8).map((topic) => {
                  const isSelected = selectedTopics?.includes(topic);
                  return onTopicClick ? (
                    <button
                      key={topic}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTopicClick(topic);
                      }}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-primary/15 hover:text-primary",
                      )}
                    >
                      {topic}
                    </button>
                  ) : (
                    <span
                      key={topic}
                      className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs"
                    >
                      {topic}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
FeedCard.displayName = "FeedCard";

export { FeedCard };
