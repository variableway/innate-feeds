import {
  ExternalLink,
  MessageSquare,
  Star,
  ThumbsUp,
  Download,
  GitFork,
  Users,
} from "lucide-react";
import type { ExternalFeedItem, SourceMetricConfig } from "@/types/external";
import { cn } from "@/lib/utils";

function formatMetric(
  key: SourceMetricConfig["key"],
  value: number | string | undefined,
): string {
  if (value === undefined || value === "" || value === null) return "";
  if (typeof value === "number" && value >= 10000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function MetricChip({
  config,
  value,
}: {
  config: SourceMetricConfig;
  value: number | string | undefined;
}) {
  const label = formatMetric(config.key, value);
  if (!label) return null;
  const Icon =
    config.key === "comments"
      ? MessageSquare
      : config.key === "stars"
        ? Star
        : config.key === "score"
          ? ThumbsUp
          : config.key === "downloads"
            ? Download
            : config.key === "forks"
              ? GitFork
              : config.key === "teamSize"
                ? Users
                : null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      {Icon && <Icon className="h-3 w-3" />}
      {config.key === "batch" || config.key === "status" ? (
        <span title={config.label}>{label}</span>
      ) : (
        <span>
          {label} <span className="opacity-70">{config.label}</span>
        </span>
      )}
    </span>
  );
}

export function ExternalItemCard({
  item,
  metrics,
  className,
}: {
  item: ExternalFeedItem;
  metrics: SourceMetricConfig[];
  className?: string;
}) {
  const link = item.externalUrl || item.url;
  const author = item.metadata.author ?? item.metadata.submitter;
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 font-medium text-foreground group-hover:underline">
          {item.title}
        </span>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {(item.tagline || item.description) && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {item.tagline || item.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {metrics.map((config) => (
          <MetricChip
            key={config.key}
            config={config}
            value={item.metrics[config.key]}
          />
        ))}
        {item.categories.slice(0, 3).map((category) => (
          <span
            key={category}
            className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
          >
            {category}
          </span>
        ))}
      </div>
      {author ? (
        <span className="text-[11px] text-muted-foreground">
          @{String(author)}
        </span>
      ) : null}
    </a>
  );
}
