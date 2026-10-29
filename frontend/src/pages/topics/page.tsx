import { Link } from "@tanstack/react-router";
import { Hash, Search } from "lucide-react";
import { useTopicsIndex } from "@/hooks/use-topics";
import { formatDate } from "@/lib/utils";

/**
 * GitHub Topics datasource (GH #24) — index of the synced topics.
 *
 * Every topic keeps the top 50 repos of `github.com/topics/{topic}`; repos
 * that already exist in the trending/starred feeds are flagged instead of
 * being re-reported as new — but they stay in the list, so opening a topic
 * shows the complete picture.
 */
export function TopicsPage() {
  const { topics, total, updatedAt, loading, error, search, setSearch } =
    useTopicsIndex();

  return (
    <div className="w-full space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">GitHub Topics</h1>
        <p className="text-sm text-muted-foreground">
          Top 50 repos per topic. Repos already in the trending/starred feeds
          are marked &ldquo;In feeds&rdquo; instead of being counted as new.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter topics…"
            aria-label="Filter topics"
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {updatedAt && (
          <span className="text-xs text-muted-foreground">
            synced {formatDate(updatedAt)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {search
            ? `No topic matches "${search}".`
            : "No topics synced yet. Run `bun run sync:topics` to collect them."}
        </div>
      ) : (
        <>
          {search && (
            <p className="text-xs text-muted-foreground">
              {topics.length} of {total} topics
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <Link
                key={topic.topic}
                to="/topics/$topic"
                params={{ topic: topic.topic }}
                className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground group-hover:underline">
                    {topic.topic}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                    {topic.newCount} new
                  </span>
                  <span>{topic.count} repos</span>
                  {topic.existingCount > 0 && (
                    <span>{topic.existingCount} in feeds</span>
                  )}
                </div>
                {topic.fetchedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    updated {formatDate(topic.fetchedAt)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
