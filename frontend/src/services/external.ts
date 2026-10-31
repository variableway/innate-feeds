/**
 * External feed sources client (GH #31). Dual-mode like services/topics.ts:
 *  - API mode:    GET /api/external, GET /api/external/:source
 *  - static mode: GET {STATIC_BASE}/external/index.json, /external/{source}.json
 */

import type {
  ExternalFeedItem,
  ExternalIndex,
  ExternalSourceEntry,
  ExternalSourceId,
  ExternalSourcePayload,
} from "@/types/external";
import { isStaticMode } from "./feeds";

const API_BASE = "/api";

const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");

const FETCH_TIMEOUT_MS = 15000;

const SOURCE_IDS: ExternalSourceId[] = [
  "producthunt",
  "yc",
  "a16z",
  "hackernews",
  "huggingface",
  "github-new",
  "devto",
  "lobsters",
];

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function normalizeItem(raw: Record<string, unknown>): ExternalFeedItem {
  const metricsRaw = (raw.metrics ?? {}) as Record<string, unknown>;
  return {
    id: str(raw.id),
    source: (SOURCE_IDS as string[]).includes(str(raw.source))
      ? (raw.source as ExternalSourceId)
      : "producthunt",
    title: str(raw.title),
    tagline: str(raw.tagline),
    description: str(raw.description),
    url: str(raw.url),
    externalUrl: raw.externalUrl ? str(raw.externalUrl) : null,
    imageUrl: raw.imageUrl ? str(raw.imageUrl) : null,
    categories: Array.isArray(raw.categories)
      ? raw.categories.map((t) => str(t))
      : [],
    metrics: {
      score: num(metricsRaw.score),
      comments: num(metricsRaw.comments),
      stars: num(metricsRaw.stars),
      downloads: num(metricsRaw.downloads),
      forks: num(metricsRaw.forks),
      teamSize: num(metricsRaw.teamSize),
      batch: metricsRaw.batch ? str(metricsRaw.batch) : undefined,
      status: metricsRaw.status ? str(metricsRaw.status) : undefined,
    },
    metadata: (raw.metadata ?? {}) as Record<string, unknown>,
    fetchedAt: str(raw.fetchedAt),
    publishedAt: raw.publishedAt ? str(raw.publishedAt) : null,
  };
}

function normalizeEntry(raw: Record<string, unknown>): ExternalSourceEntry {
  return {
    source: (SOURCE_IDS as string[]).includes(str(raw.source))
      ? (raw.source as ExternalSourceId)
      : "producthunt",
    title: str(raw.title),
    description: str(raw.description),
    homepage: str(raw.homepage),
    count: num(raw.count) ?? 0,
    label: raw.label ? str(raw.label) : null,
    fetchedAt: raw.fetchedAt ? str(raw.fetchedAt) : null,
    snapshots: num(raw.snapshots),
    synced: raw.synced === true,
  };
}

/** Index of every external feed source. */
export async function fetchExternalIndex(): Promise<ExternalIndex> {
  const payload = isStaticMode()
    ? await fetchJson<Record<string, unknown>>(
        `${STATIC_BASE}/external/index.json`,
      )
    : await fetchJson<Record<string, unknown>>(`${API_BASE}/external`);

  const sources = Array.isArray(payload.sources)
    ? payload.sources.map((raw) =>
        normalizeEntry(raw as Record<string, unknown>),
      )
    : [];
  return {
    updatedAt: payload.updatedAt ? str(payload.updatedAt) : null,
    sources,
  };
}

/** One source's latest snapshot. */
export async function fetchExternalSource(
  source: ExternalSourceId,
): Promise<ExternalSourcePayload> {
  const raw = isStaticMode()
    ? await fetchJson<Record<string, unknown>>(
        `${STATIC_BASE}/external/${source}.json`,
      )
    : await fetchJson<Record<string, unknown>>(
        `${API_BASE}/external/${encodeURIComponent(source)}`,
      );

  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    source,
    title: str(raw.title) || source,
    description: str(raw.description),
    label: str(raw.label),
    fetchedAt: str(raw.fetchedAt),
    count: (num(raw.count) ?? 0) || items.length,
    items: items.map((item) => normalizeItem(item as Record<string, unknown>)),
  };
}

export { normalizeItem };
