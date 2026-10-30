import * as React from "react";
import {
  addUserTopic,
  fetchTopicDetail,
  fetchTopicsIndex,
} from "@/services/topics";
import type {
  TopicDetail,
  TopicRepo,
  TopicSort,
  TopicSummary,
} from "@/types/topics";

function matchesSearch(repo: TopicRepo, needle: string): boolean {
  if (!needle) return true;
  const hay =
    `${repo.fullName} ${repo.description} ${repo.language ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

function sortRepos(repos: TopicRepo[], sort: TopicSort): TopicRepo[] {
  const copy = [...repos];
  switch (sort) {
    case "updated":
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "new":
      // New discoveries first: not in the feeds yet, then first-seen repos.
      return copy.sort(
        (a, b) =>
          Number(b.isNew && !b.existing) - Number(a.isNew && !a.existing) ||
          Number(b.isNew) - Number(a.isNew) ||
          b.stars - a.stars,
      );
    case "stars":
    default:
      return copy.sort((a, b) => b.stars - a.stars);
  }
}

/** Topic index (GH #24) with a simple name filter. */
export function useTopicsIndex() {
  const [topics, setTopics] = React.useState<TopicSummary[]>([]);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savingError, setSavingError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTopicsIndex()
      .then((data) => {
        if (cancelled) return;
        setTopics(data.topics);
        setUpdatedAt(data.updatedAt);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTopics([]);
        setError(err instanceof Error ? err.message : "Failed to load topics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const addTopic = async (rawTopic: string): Promise<boolean> => {
    const topic = rawTopic.trim().toLowerCase();
    if (!topic || saving) return false;
    setSaving(true);
    setSavingError(null);
    try {
      await addUserTopic(topic);
      setReloadKey((value) => value + 1);
      return true;
    } catch (err) {
      setSavingError(
        err instanceof Error ? err.message : "Failed to add topic",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return topics;
    return topics.filter((t) => t.topic.toLowerCase().includes(needle));
  }, [topics, search]);

  return {
    topics: filtered,
    total: topics.length,
    updatedAt,
    loading,
    error,
    search,
    setSearch,
    saving,
    savingError,
    addTopic,
  };
}

/** One topic: its repos plus search/sort/"hide known repos" controls. */
export function useTopic(topic: string | undefined) {
  const [detail, setDetail] = React.useState<TopicDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<TopicSort>("stars");
  // Skipped repos (already in the feeds) stay visible by default — the topic
  // view is the place to look at the full list.
  const [hideExisting, setHideExisting] = React.useState(false);

  React.useEffect(() => {
    if (!topic) {
      setDetail(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTopicDetail(topic)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Failed to load topic");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topic]);

  const items = React.useMemo(() => {
    const rows = (detail?.items ?? []).filter(
      (repo) => !hideExisting || !repo.existing,
    );
    return sortRepos(
      rows.filter((repo) => matchesSearch(repo, search)),
      sort,
    );
  }, [detail, hideExisting, search, sort]);

  return {
    topic: detail?.topic ?? topic ?? "",
    items,
    count: detail?.count ?? 0,
    newCount: detail?.newCount ?? 0,
    existingCount: detail?.existingCount ?? 0,
    fetchedAt: detail?.fetchedAt ?? null,
    loading,
    error,
    search,
    setSearch,
    sort,
    setSort,
    hideExisting,
    setHideExisting,
  };
}
