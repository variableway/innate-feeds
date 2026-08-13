import * as React from "react";
import { useEffect, useState } from "react";
import { ExternalLink, MessageSquare, X } from "lucide-react";
import type { DigestFeedItem } from "@/types/feed";
import { fetchDigestDetail } from "@/services/feeds";
import { MarkdownBody } from "@/components/markdown-body";
import { cn, formatDate } from "@/lib/utils";

interface DigestDetailPaneProps {
  digestId: string;
  /** Optional list row for instant chrome before detail fetch. */
  preview?: DigestFeedItem | null;
  onClose: () => void;
}

export function DigestDetailPane({
  digestId,
  preview,
  onClose,
}: DigestDetailPaneProps) {
  const [item, setItem] = useState<DigestFeedItem | null>(preview ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (preview?.id === digestId) {
      setItem(preview);
    }

    fetchDigestDetail(digestId)
      .then((detail) => {
        if (!cancelled) {
          setItem(detail);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load digest",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [digestId, preview]);

  const title = item?.title ?? "Loading…";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-start gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item?.category && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                {item.category}
              </span>
            )}
            {item && (
              <span className="rounded-full border px-2 py-0.5">
                {item.sourceRepo}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-base font-semibold leading-snug">{title}</h2>
          {item && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {item.authorAvatarUrl && (
                  <img
                    src={item.authorAvatarUrl}
                    alt=""
                    className="h-4 w-4 rounded-full"
                  />
                )}
                @{item.authorLogin}
              </span>
              <span>{formatDate(item.issueCreatedAt)}</span>
              {item.comments > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {item.comments}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {item?.primaryUrl && (
            <a
              href={item.primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              Open link
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {item && (
            <a
              href={item.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close detail"
            className="rounded-md border p-1.5 hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && !item?.bodyMarkdown ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={cn("h-4 animate-pulse rounded bg-muted")}
                style={{ width: `${85 - i * 7}%` }}
              />
            ))}
          </div>
        ) : error && !item?.bodyMarkdown ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Could not load body</p>
            <p className="mt-1">{error}</p>
            {item?.excerpt && <p className="mt-3">{item.excerpt}</p>}
            {item && (
              <a
                href={item.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : (
          <MarkdownBody
            markdown={item?.bodyMarkdown || ""}
            emptyMessage={
              item?.excerpt
                ? `${item.excerpt}\n\n(Full body unavailable — open on GitHub.)`
                : "No issue body."
            }
          />
        )}
      </div>
    </div>
  );
}
