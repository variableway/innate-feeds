/**
 * GitHub Topics store (GH #24).
 *
 * Layout under `~/.innate/github-topics/`:
 *
 *   topics/index.json     # index of the synced topics
 *   topics/{topic}.json   # per-topic snapshot (top-N repos of that topic)
 *
 * A snapshot keeps **every** fetched repo of the topic — including the ones
 * that were skipped during collection because they already exist in the
 * trending/starred feeds or were already seen in an earlier snapshot of the
 * same topic. Clicking a topic therefore always shows the full list, while
 * `firstSeenAt` / `existing` flag what is genuinely new.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSourceDir } from "../collector/shared/storage.js";
import type { ExternalFeedItem } from "../collector/shared/types.js";

/** One repo inside a topic snapshot. */
export interface TopicSnapshotItem extends ExternalFeedItem {
  /** ISO time the repo was first seen in this topic's snapshots. */
  firstSeenAt: string;
}

export interface TopicSnapshot {
  source: "github-topics";
  topic: string;
  fetchedAt: string;
  count: number;
  items: TopicSnapshotItem[];
}

export interface TopicIndexEntry {
  topic: string;
  file: string;
  count: number;
  /** New discoveries: first seen in the latest sync and not in the feeds. */
  newCount: number;
  fetchedAt: string;
}

export interface TopicIndex {
  source: "github-topics";
  schemaVersion: 1;
  updatedAt: string;
  topics: TopicIndexEntry[];
}

/** Repo shape served to the frontend (mirrors `GitHubRepo` + topic flags). */
export interface TopicRepo {
  id: string;
  repoId: number;
  fullName: string;
  name: string;
  description: string;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  language: string | null;
  topics: string[];
  owner: { login: string; avatarUrl: string; url: string };
  createdAt: string;
  updatedAt: string;
  /** First time the repo showed up in this topic. */
  firstSeenAt: string;
  /** New in the latest sync of this topic. */
  isNew: boolean;
  /** Already present in the trending/starred feeds. */
  existing: boolean;
}

export interface TopicSummary {
  topic: string;
  count: number;
  newCount: number;
  existingCount: number;
  fetchedAt: string;
}

export interface TopicsIndexResponse {
  topics: TopicSummary[];
  updatedAt: string | null;
}

export interface TopicResponse {
  topic: string;
  fetchedAt: string;
  count: number;
  newCount: number;
  existingCount: number;
  items: TopicRepo[];
}

export function getTopicsDir(): string {
  return join(getSourceDir("github-topics"), "topics");
}

/** Topic slugs are file names — keep them filesystem safe. */
export function slugifyTopic(topic: string): string {
  return (
    topic
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic"
  );
}

export function topicFileName(topic: string): string {
  return `${slugifyTopic(topic)}.json`;
}

export function readTopicIndex(): TopicIndex | null {
  const path = join(getTopicsDir(), "index.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as TopicIndex;
  } catch {
    return null;
  }
}

export function writeTopicIndex(index: TopicIndex): void {
  const dir = getTopicsDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "index.json"),
    JSON.stringify(index, null, 2),
    "utf-8",
  );
}

export function readTopicSnapshot(topic: string): TopicSnapshot | null {
  const path = join(getTopicsDir(), topicFileName(topic));
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as TopicSnapshot;
  } catch {
    return null;
  }
}

export interface SaveTopicSnapshotResult {
  path: string;
  count: number;
  newCount: number;
  bytes: number;
}

/** Persist one topic snapshot and refresh the topic index. */
export function saveTopicSnapshot(
  topic: string,
  items: TopicSnapshotItem[],
  fetchedAt: string,
  /** New discoveries (first seen + not in the feeds); defaults to first-seen count. */
  newCount?: number,
): SaveTopicSnapshotResult {
  const dir = getTopicsDir();
  mkdirSync(dir, { recursive: true });

  const file = topicFileName(topic);
  const snapshot: TopicSnapshot = {
    source: "github-topics",
    topic,
    fetchedAt,
    count: items.length,
    items,
  };
  const json = JSON.stringify(snapshot, null, 2);
  const path = join(dir, file);
  writeFileSync(path, json, "utf-8");

  const discoveries =
    newCount ?? items.filter((i) => i.firstSeenAt === fetchedAt).length;
  const index = readTopicIndex() ?? {
    source: "github-topics",
    schemaVersion: 1,
    updatedAt: fetchedAt,
    topics: [],
  };
  const entry: TopicIndexEntry = {
    topic,
    file,
    count: items.length,
    newCount: discoveries,
    fetchedAt,
  };
  const idx = index.topics.findIndex((t) => t.topic === topic);
  if (idx >= 0) index.topics[idx] = entry;
  else index.topics.push(entry);
  index.updatedAt = fetchedAt;
  writeTopicIndex(index);

  return {
    path,
    count: items.length,
    newCount: discoveries,
    bytes: Buffer.byteLength(json, "utf-8"),
  };
}

/** Map a stored item to the frontend DTO, resolving the live "existing" flag. */
export function toTopicRepo(
  item: TopicSnapshotItem,
  snapshotFetchedAt: string,
  existingFullNames: Set<string>,
): TopicRepo {
  const meta = item.metadata as Record<string, unknown>;
  const fullName = String(meta.fullName ?? item.title);
  const ownerLogin = String(meta.ownerLogin ?? fullName.split("/")[0] ?? "");
  return {
    id: item.id,
    repoId: Number(meta.githubRepoId ?? 0),
    fullName,
    name: item.title,
    description: item.tagline || String(meta.description ?? ""),
    url: item.url,
    homepage: item.externalUrl,
    stars: item.metrics.stars ?? 0,
    forks: Number(meta.forks ?? 0),
    watchers: Number(meta.watchers ?? 0),
    language: (meta.language as string | null) ?? null,
    topics: Array.isArray(meta.topics)
      ? (meta.topics as string[])
      : Array.isArray(item.categories)
        ? item.categories
        : [],
    owner: {
      login: ownerLogin,
      avatarUrl: String(meta.ownerAvatarUrl ?? item.imageUrl ?? ""),
      url: String(meta.ownerUrl ?? `https://github.com/${ownerLogin}`),
    },
    createdAt: String(meta.createdAt ?? ""),
    updatedAt: String(meta.updatedAt ?? ""),
    firstSeenAt: item.firstSeenAt,
    isNew: item.firstSeenAt === snapshotFetchedAt,
    existing: existingFullNames.has(fullName.toLowerCase()),
  };
}

/** Index of every synced topic, with live counts. */
export function buildTopicsIndex(
  existingFullNames: Set<string>,
): TopicsIndexResponse {
  const index = readTopicIndex();
  if (!index) return { topics: [], updatedAt: null };

  const topics: TopicSummary[] = [];
  for (const entry of index.topics) {
    const snapshot = readTopicSnapshot(entry.topic);
    if (!snapshot) continue;
    const items = snapshot.items.map((item) =>
      toTopicRepo(item, snapshot.fetchedAt, existingFullNames),
    );
    topics.push({
      topic: entry.topic,
      count: items.length,
      newCount: items.filter((i) => i.isNew && !i.existing).length,
      existingCount: items.filter((i) => i.existing).length,
      fetchedAt: snapshot.fetchedAt,
    });
  }

  topics.sort(
    (a, b) => b.newCount - a.newCount || a.topic.localeCompare(b.topic),
  );
  return { topics, updatedAt: index.updatedAt };
}

/** Full payload of one topic (all repos, skipped ones included). */
export function buildTopicResponse(
  topic: string,
  existingFullNames: Set<string>,
): TopicResponse | null {
  const snapshot = readTopicSnapshot(topic);
  if (!snapshot) return null;
  const items = snapshot.items.map((item) =>
    toTopicRepo(item, snapshot.fetchedAt, existingFullNames),
  );
  return {
    topic: snapshot.topic,
    fetchedAt: snapshot.fetchedAt,
    count: items.length,
    newCount: items.filter((i) => i.isNew && !i.existing).length,
    existingCount: items.filter((i) => i.existing).length,
    items,
  };
}
