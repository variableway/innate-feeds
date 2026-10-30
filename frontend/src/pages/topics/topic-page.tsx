import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Hash,
  Search,
} from "lucide-react";
import { useTopic } from "@/hooks/use-topics";
import { TopicRepoCard } from "@/components/topic-repo-card";
import { formatDate } from "@/lib/utils";
import type { TopicSort } from "@/types/topics";
import * as React from "react";

const SORTS: { value: TopicSort; label: string }[] = [
  { value: "stars", label: "Stars" },
  { value: "updated", label: "Updated" },
  { value: "new", label: "New first" },
];

const PAGE_SIZE = 24;

/**
 * One GitHub topic (GH #24) — the top 50 repos of the topic.
 *
 * Repos that were skipped during collection (already in the trending/starred
 * feeds, or already seen in an earlier snapshot) are listed here as well and
 * flagged with "In feeds" / "New".
 */
export function TopicPage() {
  const params = useParams({ strict: false }) as { topic?: string };
  const navigate = useNavigate();
  const topic = params.topic ?? "";
  const {
    items,
    count,
    newCount,
    existingCount,
    fetchedAt,
    loading,
    error,
    search,
    setSearch,
    sort,
    setSort,
    hideExisting,
    setHideExisting,
  } = useTopic(topic);
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const openTopic = (next: string) => {
    if (!next || next === topic) return;
    void navigate({ to: "/topics/$topic", params: { topic: next } });
  };

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [topic, hideExisting, search, sort]);

  const visibleItems = items.slice(0, visibleCount);
  const remainingCount = Math.max(0, items.length - visibleCount);

  const stepVisibleCount = (delta: number) => {
    setVisibleCount((current) =>
      Math.min(items.length, Math.max(PAGE_SIZE, current + delta * PAGE_SIZE)),
    );
  };

  return (
    <div className="w-full space-y-4 p-4">
      <header className="space-y-2">
        <Link
          to="/topics"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All topics
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">{topic}</h1>
          <a
            href={`https://github.com/topics/${topic}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            github.com/topics/{topic}
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{count} repos</span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
            {newCount} new
          </span>
          {existingCount > 0 && <span>{existingCount} in feeds</span>}
          {fetchedAt && <span>synced {formatDate(fetchedAt)}</span>}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos…"
            aria-label="Search repos"
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSort(option.value)}
              className={
                sort === option.value
                  ? "rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
                  : "rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={hideExisting}
            onChange={(e) => setHideExisting(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Hide repos already in the feeds
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {search || hideExisting
            ? "No repo matches the current filters."
            : `No repos collected for "${topic}" yet.`}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((repo) => (
              <TopicRepoCard
                key={repo.id}
                repo={repo}
                className="h-full"
                onTopicClick={openTopic}
              />
            ))}
          </div>
          {items.length > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
              <span>
                Showing {visibleItems.length} of {items.length} repos
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepVisibleCount(-1)}
                  disabled={visibleCount <= PAGE_SIZE}
                  className="rounded-md border px-2 py-1 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => stepVisibleCount(1)}
                  disabled={remainingCount === 0}
                  className="rounded-md border px-2 py-1 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
