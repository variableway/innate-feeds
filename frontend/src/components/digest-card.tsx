import * as React from "react";
import { ExternalLink, MessageSquare } from "lucide-react";
import type { DigestFeedItem } from "@/types/feed";
import { cn, formatDate } from "@/lib/utils";

interface DigestCardProps extends React.HTMLAttributes<HTMLDivElement> {
  item: DigestFeedItem;
  compact?: boolean;
  selected?: boolean;
  onItemSelect?: (item: DigestFeedItem) => void;
}

function displayTitle(item: DigestFeedItem): string {
  if (!item.category) return item.title;
  const prefixes = [`【${item.category}】`, `[${item.category}]`];
  for (const p of prefixes) {
    if (item.title.startsWith(p)) {
      return item.title.slice(p.length).trim() || item.title;
    }
  }
  return item.title;
}

const DigestCard = React.forwardRef<HTMLDivElement, DigestCardProps>(
  (
    {
      item,
      compact = false,
      selected = false,
      onItemSelect,
      className,
      ...props
    },
    ref,
  ) => {
    const title = displayTitle(item);

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
          "group flex flex-col rounded-lg border bg-card transition-colors",
          onItemSelect && "cursor-pointer hover:bg-accent",
          selected && "border-primary bg-accent/60 ring-1 ring-primary/30",
          compact ? "p-3" : "p-4",
          className,
        )}
        {...props}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {item.category && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              {item.category}
            </span>
          )}
          <span className="rounded-full border px-2 py-0.5">
            {item.sourceRepo}
          </span>
          <span className="ml-auto">{formatDate(item.issueCreatedAt)}</span>
        </div>

        <h3
          className={cn(
            "mt-2 font-semibold text-foreground",
            compact ? "line-clamp-2 text-sm" : "line-clamp-2 text-base",
          )}
        >
          {title}
        </h3>

        {!compact && item.excerpt && (
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
            {item.excerpt}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {item.authorAvatarUrl ? (
              <img
                src={item.authorAvatarUrl}
                alt=""
                className="h-4 w-4 rounded-full"
              />
            ) : null}
            @{item.authorLogin}
          </span>
          {item.comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {item.comments}
            </span>
          )}
          {!compact && item.primaryUrl && (
            <a
              href={item.primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open link
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {!compact && (
            <a
              href={item.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              View on GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    );
  },
);
DigestCard.displayName = "DigestCard";

export { DigestCard };
