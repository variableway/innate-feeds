/**
 * Trendshift data client (GH #23). Dual-mode like services/feeds.ts:
 *  - API mode:    GET /api/trendshift/:timeframe?language=…
 *  - static mode: GET {STATIC_BASE}/trendshift/{timeframe}/{timeframe}-{lang}.json
 *  - fallback:    the public Trendshift CDN (keeps Pages fresh between deploys).
 */

import type {
  TrendshiftLanguageFilter,
  TrendshiftRepo,
  TrendshiftTimeframe,
} from "@/types/trendshift";
import { isStaticMode } from "./feeds";

const API_BASE = "/api";

const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");

const CDN_BASE = "https://quantavil.github.io/trendshift/data";

const FETCH_TIMEOUT_MS = 15000;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((t) =>
      typeof t === "string"
        ? t
        : t && typeof t === "object"
          ? str(
              (t as { slug?: unknown }).slug || (t as { name?: unknown }).name,
            )
          : "",
    )
    .filter(Boolean);
}

/** Accepts normalized camelCase rows (API / static export) and raw CDN snake_case rows. */
export function normalizeTrendshiftRepo(
  raw: Record<string, unknown>,
  fallbackTimeframe: TrendshiftTimeframe,
  fallbackLanguage: TrendshiftLanguageFilter,
): TrendshiftRepo {
  const fullName = str(raw.fullName ?? raw.full_name);
  return {
    periodKey: str(raw.periodKey ?? raw.period_key),
    rank: numOrNull(raw.rank) ?? 0,
    score: numOrNull(raw.score),
    fullName,
    githubUrl:
      str(raw.githubUrl ?? raw.github_url) || `https://github.com/${fullName}`,
    description: str(raw.description ?? raw.repository_description),
    language: str(raw.language ?? raw.repository_language) || null,
    starsTotal: numOrNull(
      raw.starsTotal ?? raw.stars_total ?? raw.repository_stars,
    ),
    starsGained: numOrNull(
      raw.starsGained ?? raw.stars_gained ?? raw.repository_stars_gained,
    ),
    forksTotal: numOrNull(
      raw.forksTotal ?? raw.forks_total ?? raw.repository_forks,
    ),
    forksGained: numOrNull(
      raw.forksGained ?? raw.forks_gained ?? raw.repository_forks_gained,
    ),
    createdAt:
      str(raw.createdAt ?? raw.created_at ?? raw.repository_created_at) || null,
    tags: strList(raw.tags),
    socialMentionPlatforms: strList(
      raw.socialMentionPlatforms ?? raw.social_mention_platforms,
    ),
    timeframe: (str(raw.timeframe) as TrendshiftTimeframe) || fallbackTimeframe,
    languageFilter:
      (str(
        raw.languageFilter ?? raw.language_filter,
      ) as TrendshiftLanguageFilter) || fallbackLanguage,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export async function fetchTrendshiftSlice(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): Promise<TrendshiftRepo[]> {
  let lastError: unknown;
  const sources: (() => Promise<unknown>)[] = isStaticMode()
    ? [
        () =>
          fetchJson<unknown[]>(
            `${STATIC_BASE}/trendshift/${timeframe}/${timeframe}-${language}.json`,
          ),
        () =>
          fetchJson<unknown[]>(
            `${CDN_BASE}/${timeframe}/${timeframe}-${language}.json`,
          ),
      ]
    : [
        () =>
          fetchJson<{ items: unknown[] }>(
            `${API_BASE}/trendshift/${timeframe}?language=${language}`,
          ),
        () =>
          fetchJson<unknown[]>(
            `${CDN_BASE}/${timeframe}/${timeframe}-${language}.json`,
          ),
      ];

  for (const load of sources) {
    try {
      const payload = await load();
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { items?: unknown[] }).items)
          ? (payload as { items: unknown[] }).items
          : null;
      if (!rows) throw new Error("Unexpected trendshift payload shape");
      return rows.map((r) =>
        normalizeTrendshiftRepo(
          r as Record<string, unknown>,
          timeframe,
          language,
        ),
      );
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to load trendshift slice");
}
