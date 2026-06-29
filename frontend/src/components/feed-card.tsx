import * as React from "react";
import { Star, GitFork, ExternalLink } from "lucide-react";
import type { FeedItem } from "@/types/feed";
import { formatNumber, cn } from "@/lib/utils";

interface FeedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  item: FeedItem;
  selectedTopics?: string[];
  onTopicClick?: (topic: string) => void;
}

/**
 * FeedCard - simplified, no period tags
 */
const FeedCard = React.forwardRef<HTMLDivElement, FeedCardProps>(
  ({ item, selectedTopics, onTopicClick, className, ...props }, ref) => {
    const { repo } = item;

    return (
      <div
        ref={ref}
        className={cn(
          "group rounded-lg border bg-card p-4 transition-colors hover:bg-accent",
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <a href={repo.owner.url} target="_blank" rel="noopener noreferrer">
            <img
              src={repo.owner.avatarUrl}
              alt={repo.owner.login}
              className="h-10 w-10 rounded-full"
            />
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:underline truncate"
              >
                {repo.fullName}
              </a>
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            {repo.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {repo.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
              <span className="inline-flex items-center gap-1">
                <GitFork className="h-3.5 w-3.5" />
                {formatNumber(repo.forks)}
              </span>
            </div>
            {repo.topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {repo.topics.map((topic) => {
                  const isSelected = selectedTopics?.includes(topic);
                  return onTopicClick ? (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => onTopicClick(topic)}
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
