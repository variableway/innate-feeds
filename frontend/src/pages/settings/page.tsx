import { useEffect, useState } from "react";
import { Download, Eye, X } from "lucide-react";
import { toast } from "sonner";
import {
  downloadRepoReadme,
  fetchCachedReadmes,
  fetchRepoReadme,
  isStaticMode,
  type CachedReadmeListItem,
} from "@/services/feeds";
import { MarkdownBody } from "@/components/markdown-body";

const WEB_READMES_DIR = "./readmes";

export function SettingsPage() {
  const staticMode = isStaticMode();
  const [cached, setCached] = useState<CachedReadmeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewing, setReviewing] = useState<CachedReadmeListItem | null>(null);
  const [reviewMarkdown, setReviewMarkdown] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCachedReadmes()
      .then((list) => {
        if (cancelled) return;
        setCached(list.items);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openReview = async (item: CachedReadmeListItem) => {
    setReviewing(item);
    setReviewMarkdown(null);
    setReviewError(null);
    setReviewLoading(true);
    try {
      const readme = await fetchRepoReadme(item.fullName);
      setReviewMarkdown(readme.markdown);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Failed to load README",
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const onDownload = async (item: CachedReadmeListItem) => {
    try {
      await downloadRepoReadme(item.owner, item.repo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          READMEs are stored under ./readmes. Review them here or download a
          Markdown copy — this is not a folder on your PC.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Settings unavailable</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <>
          <section className="space-y-3 rounded-lg border p-4">
            <div>
              <h2 className="text-sm font-medium">README cache directory</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Files are written as{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  {"{owner}/{repo}.md"}
                </code>
                .
              </p>
            </div>
            <dl className="space-y-2 text-xs text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Directory</dt>
                <dd className="mt-0.5 font-mono">{WEB_READMES_DIR}</dd>
              </div>
              {staticMode && (
                <p>
                  On GitHub Pages, READMEs are fetched live from GitHub when you
                  open a repository. Download from the detail pane.
                </p>
              )}
            </dl>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <div>
              <h2 className="text-sm font-medium">Cached READMEs</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Review in the app or download a Markdown file.
              </p>
            </div>

            {cached.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cached READMEs yet. Open a repository in Trending or Starred
                to load its README from GitHub.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {cached.map((item) => (
                  <li
                    key={item.fullName}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.fullName}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {WEB_READMES_DIR}/{item.relativePath}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => void openReview(item)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Eye className="h-3 w-3" />
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDownload(item)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="truncate text-sm font-semibold">
                {reviewing.fullName}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void onDownload(reviewing)}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setReviewing(null)}
                  className="rounded-md border p-1.5 hover:bg-accent"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {reviewLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-4 animate-pulse rounded bg-muted"
                      style={{ width: `${70 - i * 8}%` }}
                    />
                  ))}
                </div>
              ) : reviewError ? (
                <p className="text-sm text-muted-foreground">{reviewError}</p>
              ) : (
                <MarkdownBody
                  markdown={reviewMarkdown || ""}
                  emptyMessage="No README content."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
