/**
 * GitHub Topics client (GH #24). Dual-mode like services/feeds.ts:
 *  - API mode:    GET /api/topics, GET /api/topics/:topic
 *  - static mode: GET {STATIC_BASE}/topics/index.json, {STATIC_BASE}/topics/{topic}.json
 */

import type { TopicDetail, TopicRepo, TopicsIndex } from "@/types/topics";
import { isStaticMode } from "./feeds";

const API_BASE = "/api";

const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");

const FETCH_TIMEOUT_MS = 15000;

function slugifyTopic(topic: string): string {
  return (
    topic
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic"
  );
}

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function normalizeTopicRepo(raw: Record<string, unknown>): TopicRepo {
  const owner = (raw.owner ?? {}) as Record<string, unknown>;
  const fullName = str(raw.fullName);
  return {
    id: str(raw.id) || fullName,
    repoId: num(raw.repoId),
    fullName,
    name: str(raw.name) || fullName.split("/")[1] || "",
    description: str(raw.description),
    url: str(raw.url) || `https://github.com/${fullName}`,
    homepage: raw.homepage ? str(raw.homepage) : null,
    stars: num(raw.stars),
    forks: num(raw.forks),
    watchers: num(raw.watchers),
    language: raw.language ? str(raw.language) : null,
    topics: Array.isArray(raw.topics) ? raw.topics.map((t) => str(t)) : [],
    owner: {
      login: str(owner.login) || fullName.split("/")[0] || "",
      avatarUrl: str(owner.avatarUrl),
      url: str(owner.url),
    },
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
    firstSeenAt: str(raw.firstSeenAt),
    isNew: raw.isNew === true,
    existing: raw.existing === true,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/** Index of every synced topic. */
export async function fetchTopicsIndex(): Promise<TopicsIndex> {
  if (isStaticMode()) {
    const payload = await fetchJson<{
      topics?: unknown[];
      updatedAt?: string | null;
    }>(`${STATIC_BASE}/topics/index.json`);
    return {
      topics: (payload.topics ?? []).map((raw) => {
        const row = raw as Record<string, unknown>;
        return {
          topic: str(row.topic),
          count: num(row.count),
          newCount: num(row.newCount),
          existingCount: num(row.existingCount),
          fetchedAt: str(row.fetchedAt),
        };
      }),
      updatedAt: payload.updatedAt ?? null,
    };
  }

  const payload = await fetchJson<{
    topics?: unknown[];
    updatedAt?: string | null;
  }>(`${API_BASE}/topics`);
  return {
    topics: (payload.topics ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        topic: str(row.topic),
        count: num(row.count),
        newCount: num(row.newCount),
        existingCount: num(row.existingCount),
        fetchedAt: str(row.fetchedAt),
      };
    }),
    updatedAt: payload.updatedAt ?? null,
  };
}

/** Save a user-added topic in API mode (GH #26). */
export async function addUserTopic(topic: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/topics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const payload = (await res.json()) as { topics?: unknown; error?: string };
  if (!res.ok) {
    throw new Error(payload.error || `HTTP ${res.status} for /api/topics`);
  }
  if (!Array.isArray(payload.topics)) return [];
  return payload.topics.map((value) => str(value));
}

/** All repos of one topic (skipped ones included — they are flagged). */
export async function fetchTopicDetail(topic: string): Promise<TopicDetail> {
  const raw = isStaticMode()
    ? await fetchJson<Record<string, unknown>>(
        `${STATIC_BASE}/topics/${slugifyTopic(topic)}.json`,
      )
    : await fetchJson<Record<string, unknown>>(
        `${API_BASE}/topics/${encodeURIComponent(topic)}`,
      );

  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    topic: str(raw.topic) || topic,
    fetchedAt: str(raw.fetchedAt),
    count: num(raw.count) || items.length,
    newCount: num(raw.newCount),
    existingCount: num(raw.existingCount),
    items: items.map((item) =>
      normalizeTopicRepo(item as Record<string, unknown>),
    ),
  };
}
