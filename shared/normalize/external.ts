/**
 * External feed item 归一化（S1，数据分离方案）。
 * 单一真相：backend 写盘前调用（collectors/shared/storage.saveItems），
 * 前端信任 payload 不再防御性归一化。
 * 边界：纯函数，无 IO / React / 运行时 API（shared/ 三禁令）。
 */

import type { ExternalFeedItem, FeedItemMetrics, FeedSource } from "../types/external.js";

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = str(v);
  return s === "" ? null : s;
}

function numOrUndefined(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return undefined;
}

/** 未知/非法 source 一律落回 "producthunt"（与前端原实现一致）。 */
export function normalizeFeedSource(v: unknown): FeedSource {
  const s = str(v);
  return VALID_SOURCES.has(s as FeedSource) ? (s as FeedSource) : "producthunt";
}

const VALID_SOURCES: Set<FeedSource> = new Set([
  "producthunt",
  "yc",
  "a16z",
  "github-topics",
  "trendshift",
  "awesome-dsh",
  "hackernews",
  "huggingface",
  "github-new",
  "devto",
  "lobsters",
  "edu-skills",
  "edu-videos",
  "edu-videos-bilibili",
]);

/** 原始 payload（collector 产出/旧快照）→ ExternalFeedItem 终态。 */
export function normalizeExternalItem(raw: unknown): ExternalFeedItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  const metricsRaw = (r.metrics ?? {}) as Record<string, unknown>;
  const metrics: FeedItemMetrics = {
    score: numOrUndefined(metricsRaw.score),
    comments: numOrUndefined(metricsRaw.comments),
    stars: numOrUndefined(metricsRaw.stars),
    downloads: numOrUndefined(metricsRaw.downloads),
    forks: numOrUndefined(metricsRaw.forks),
    teamSize: numOrUndefined(metricsRaw.teamSize),
    batch: metricsRaw.batch ? str(metricsRaw.batch) : undefined,
    status: metricsRaw.status ? str(metricsRaw.status) : undefined,
  };
  const metadata =
    r.metadata && typeof r.metadata === "object"
      ? (r.metadata as Record<string, unknown>)
      : {};
  return {
    id: str(r.id),
    source: normalizeFeedSource(r.source),
    title: str(r.title),
    tagline: str(r.tagline),
    description: str(r.description),
    url: str(r.url),
    externalUrl: strOrNull(r.externalUrl),
    imageUrl: strOrNull(r.imageUrl),
    categories: Array.isArray(r.categories) ? r.categories.map((t) => str(t)) : [],
    metrics,
    metadata,
    fetchedAt: str(r.fetchedAt),
    publishedAt: strOrNull(r.publishedAt),
  };
}
