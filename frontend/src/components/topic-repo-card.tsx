import * as React from "react";
import { ExternalLink, Star, GitFork } from "lucide-react";
import type { TopicRepo } from "@/types/topics";
import { formatNumber, cn } from "@/lib/utils";

interface TopicRepoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  repo: TopicRepo;
  /** Topic chips are clickable → open that topic. */
  onTopicClick?: (topic: string) => void;
}

/**
 * Repo card of the GitHub Topics datasource (GH #24).
 * Shows the "new" / "already in feeds" badges — repos that were skipped
 * during collection are still listed here.
 */
const TopicRepoCard = React.forwardRef<HTMLDivElement, TopicRepoCardProps>(
  ({ repo, onTopicClick, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40",
          className,
        )}
        {...props}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {repo.owner.avatarUrl ? (
            <a
              href={repo.owner.url || `https://github.com/${repo.owner.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                src={repo.owner.avatarUrl}
                alt={repo.owner.login}
                className="h-10 w-10 rounded-full"
              />
            </a>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-foreground">
                {repo.fullName}
              </span>
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="Open on GitHub"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {repo.isNew && !repo.existing && (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  New
                </span>
              )}
              {repo.existing && (
                <span
                  className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                  title="Already in the trending/starred feeds"
                >
                  In feeds
                </span>
              )}
            </div>
            {repo.description && (
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
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
              <span className="inline-flex items-center gap-1">
                <GitFork className="h-3.5 w-3.5" />
                {formatNumber(repo.forks)}
              </span>
            </div>
            {repo.topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {repo.topics.slice(0, 8).map((topic) =>
                  onTopicClick ? (
                    <button
                      key={topic}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTopicClick(topic);
                      }}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-primary"
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
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
TopicRepoCard.displayName = "TopicRepoCard";

export { TopicRepoCard };
