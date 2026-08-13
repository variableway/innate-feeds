import { useEffect, useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import type { FeedItem } from "@/types/feed";
import { downloadTextFile, fetchRepoReadme } from "@/services/feeds";
import { toast } from "sonner";
import { MarkdownBody } from "@/components/markdown-body";
import { formatNumber } from "@/lib/utils";

/** Cleared: github.com sets X-Frame-Options: deny / frame-ancestors 'none'. */
const LEGACY_VIEW_PREF_KEY = "repo-detail-view";

interface RepoDetailPaneProps {
  item: FeedItem;
  onClose: () => void;
}

export function RepoDetailPane({ item, onClose }: RepoDetailPaneProps) {
  const { repo } = item;
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_VIEW_PREF_KEY);
    } catch {
      /* ignore */
    }
  }, []);

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
    setMarkdown(null);

    fetchRepoReadme(repo.fullName)
      .then((res) => {
        if (!cancelled) {
          setMarkdown(res.markdown);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load README");
          setMarkdown(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repo.fullName]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-start gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <img
              src={repo.owner.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full"
            />
            <h2 className="truncate text-base font-semibold">{repo.fullName}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {repo.language && <span>{repo.language}</span>}
            <span>★ {formatNumber(repo.stars)}</span>
            {repo.description && (
              <span className="line-clamp-1 max-w-xl">{repo.description}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {markdown && (
            <button
              type="button"
              onClick={() => {
                try {
                  downloadTextFile(
                    `${repo.owner.login}-${repo.name}.md`,
                    markdown,
                  );
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Download failed",
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
          )}
          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Open on GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
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

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-muted"
                  style={{ width: `${70 - i * 8}%` }}
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">README unavailable</p>
              <p className="mt-1">{error}</p>
              {repo.description && (
                <p className="mt-3 text-foreground">{repo.description}</p>
              )}
              <div className="mt-4">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  Open on GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ) : (
            <MarkdownBody
              markdown={markdown || ""}
              emptyMessage="No README found for this repository."
            />
          )}
        </div>
      </div>
    </div>
  );
}
