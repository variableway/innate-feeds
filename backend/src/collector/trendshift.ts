/**
 * Trendshift collector (GH #23 integration, 数据层方案 A+B).
 *
 * Primary source (A): the published static JSON API on GitHub Pages
 *   https://quantavil.github.io/trendshift/data/
 * Alternative source (B): scrape trendshift.io leaderboards directly by
 *   requesting the Next.js RSC flight stream (header `RSC: 1`) and decoding
 *   the `initialData` payload. Clean-room implementation — no code is taken
 *   from the AGPL-3.0 quantavil/trendshift pipeline.
 *
 * Local store: ~/.innate/trendshift/{timeframe}/{timeframe}-{lang}.json
 * (normalized camelCase rows) + manifest.json.
 *
 * Run:
 *   bunx tsx src/collector/trendshift.ts                       # sync all timeframes, "all" language
 *   bunx tsx src/collector/trendshift.ts --language python,rust
 *   bunx tsx src/collector/trendshift.ts --timeframe daily --source scrape
 *   bunx tsx src/collector/trendshift.ts --no-save             # fetch and print summary only
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSourceDir } from "./shared/storage.js";

export const TRENDSHIFT_TIMEFRAMES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;
export type TrendshiftTimeframe = (typeof TRENDSHIFT_TIMEFRAMES)[number];

export const TRENDSHIFT_LANGUAGES = [
  "all",
  "c",
  "csharp",
  "cpp",
  "dart",
  "go",
  "java",
  "javascript",
  "kotlin",
  "php",
  "python",
  "ruby",
  "rust",
  "swift",
  "typescript",
  "zig",
] as const;
export type TrendshiftLanguageFilter = (typeof TRENDSHIFT_LANGUAGES)[number];

export const TRENDSHIFT_LANGUAGE_LABELS: Record<
  TrendshiftLanguageFilter,
  string
> = {
  all: "All",
  c: "C",
  csharp: "C#",
  cpp: "C++",
  dart: "Dart",
  go: "Go",
  java: "Java",
  javascript: "JavaScript",
  kotlin: "Kotlin",
  php: "PHP",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  swift: "Swift",
  typescript: "TypeScript",
  zig: "Zig",
};

export type TrendshiftSource = "cdn" | "scrape";

/** Normalized ranking snapshot row (camelCase; both sources map into this). */
export interface TrendshiftRepo {
  periodKey: string;
  rank: number;
  score: number | null;
  fullName: string;
  githubUrl: string;
  description: string;
  language: string | null;
  starsTotal: number | null;
  starsGained: number | null;
  forksTotal: number | null;
  forksGained: number | null;
  createdAt: string | null;
  tags: string[];
  socialMentionPlatforms: string[];
  timeframe: TrendshiftTimeframe;
  languageFilter: TrendshiftLanguageFilter;
}

export interface TrendshiftManifestFile {
  path: string;
  timeframe: TrendshiftTimeframe;
  language: TrendshiftLanguageFilter;
  count: number;
  fetchedAt: string;
}

export interface TrendshiftManifest {
  source: "trendshift";
  schemaVersion: 1;
  updatedAt: string;
  origin: TrendshiftSource;
  files: TrendshiftManifestFile[];
}

export interface TrendshiftSyncOptions {
  timeframes?: TrendshiftTimeframe[];
  languages?: TrendshiftLanguageFilter[];
  /** cdn = published JSON API (default); scrape = trendshift.io RSC; auto = cdn with scrape fallback */
  source?: TrendshiftSource | "auto";
  save?: boolean;
  concurrency?: number;
}

export interface TrendshiftSyncSummary {
  origin: TrendshiftSource;
  outDir: string;
  files: TrendshiftManifestFile[];
  totalRows: number;
  bytes: number;
}

export const TRENDSHIFT_CDN_BASE =
  "https://quantavil.github.io/trendshift/data";
export const TRENDSHIFT_SCRAPE_BASE = "https://trendshift.io";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Slice / manifest IO
// ---------------------------------------------------------------------------

export function getTrendshiftDir(): string {
  return getSourceDir("trendshift");
}

export function sliceFileName(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): string {
  return `${timeframe}-${language}.json`;
}

export function sliceRelPath(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): string {
  return `${timeframe}/${sliceFileName(timeframe, language)}`;
}

export function readTrendshiftManifest(): TrendshiftManifest | null {
  const path = join(getTrendshiftDir(), "manifest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as TrendshiftManifest;
}

export function readTrendshiftSlice(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): TrendshiftRepo[] | null {
  const path = join(getTrendshiftDir(), sliceRelPath(timeframe, language));
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as TrendshiftRepo[];
}

export function saveTrendshiftSlice(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
  rows: TrendshiftRepo[],
  origin: TrendshiftSource,
): { path: string; bytes: number } {
  const dir = getTrendshiftDir();
  const relPath = sliceRelPath(timeframe, language);
  mkdirSync(join(dir, timeframe), { recursive: true });
  const json = JSON.stringify(rows, null, 2);
  writeFileSync(join(dir, relPath), json, "utf-8");

  const manifest = readTrendshiftManifest() ?? {
    source: "trendshift",
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    origin,
    files: [],
  };
  const fetchedAt = new Date().toISOString();
  const entry: TrendshiftManifestFile = {
    path: relPath,
    timeframe,
    language,
    count: rows.length,
    fetchedAt,
  };
  const idx = manifest.files.findIndex((f) => f.path === relPath);
  if (idx >= 0) manifest.files[idx] = entry;
  else manifest.files.push(entry);
  manifest.updatedAt = fetchedAt;
  manifest.origin = origin;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
  return { path: join(dir, relPath), bytes: Buffer.byteLength(json, "utf-8") };
}

/** Merge `incoming` rows into `existing` by (periodKey, fullName); incoming wins. */
export function mergeSliceRows(
  existing: TrendshiftRepo[],
  incoming: TrendshiftRepo[],
): TrendshiftRepo[] {
  const key = (r: TrendshiftRepo) => `${r.periodKey}\u0000${r.fullName}`;
  const map = new Map<string, TrendshiftRepo>();
  for (const row of existing) map.set(key(row), row);
  for (const row of incoming) map.set(key(row), row);
  return [...map.values()].sort((a, b) =>
    a.periodKey === b.periodKey
      ? a.rank - b.rank
      : a.periodKey < b.periodKey
        ? 1
        : -1,
  );
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

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

function tagSlugs(v: unknown): string[] {
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

function platformNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((p) => str(p)).filter(Boolean);
}

/** Daily `YYYY-MM-DD`, weekly `YYYY-Www`, monthly `YYYY-Mmm` (zero-padded), yearly `YYYY`. */
export function derivePeriodKey(
  timeframe: TrendshiftTimeframe,
  raw: {
    date?: unknown;
    year?: unknown;
    week?: unknown;
    month?: unknown;
    week_start?: unknown;
    period_key?: unknown;
  },
): string {
  if (typeof raw.period_key === "string" && raw.period_key)
    return raw.period_key;

  const year =
    numOrNull(raw.year) ??
    numOrNull(str(raw.date).slice(0, 4)) ??
    numOrNull(str(raw.week_start).slice(0, 4)) ??
    new Date().getUTCFullYear();

  switch (timeframe) {
    case "daily": {
      const dateStr =
        str(raw.date).slice(0, 10) || str(raw.week_start).slice(0, 10);
      return dateStr || new Date().toISOString().slice(0, 10);
    }
    case "weekly": {
      const week = numOrNull(raw.week);
      if (week != null) return `${year}-W${String(week).padStart(2, "0")}`;
      // Fallback: ISO week of the given date.
      return isoWeekKey(
        str(raw.date) || str(raw.week_start) || new Date().toISOString(),
      );
    }
    case "monthly": {
      const month =
        numOrNull(raw.month) ??
        numOrNull(str(raw.date).slice(5, 7)) ??
        new Date().getUTCMonth() + 1;
      return `${year}-M${String(month).padStart(2, "0")}`;
    }
    case "yearly":
      return String(year);
  }
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr.length > 10 ? dateStr : `${dateStr}T00:00:00Z`);
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // Thursday of this week
  const year = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 +
    Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Map a published CDN record (snake_case) into a normalized row. */
export function normalizeCdnRecord(
  raw: Record<string, unknown>,
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): TrendshiftRepo {
  const fullName = str(raw.full_name);
  return {
    periodKey: derivePeriodKey(timeframe, raw),
    rank: numOrNull(raw.rank) ?? 0,
    score: numOrNull(raw.score),
    fullName,
    githubUrl: str(raw.github_url) || `https://github.com/${fullName}`,
    description: str(raw.description),
    language: str(raw.language) || null,
    starsTotal: numOrNull(raw.stars_total),
    starsGained: numOrNull(raw.stars_gained),
    forksTotal: numOrNull(raw.forks_total),
    forksGained: numOrNull(raw.forks_gained),
    createdAt: str(raw.created_at) || null,
    tags: tagSlugs(raw.tags),
    socialMentionPlatforms: platformNames(raw.social_mention_platforms),
    timeframe: (str(raw.timeframe) as TrendshiftTimeframe) || timeframe,
    languageFilter:
      (str(raw.language_filter) as TrendshiftLanguageFilter) || language,
  };
}

/** Map a scraped trendshift.io `initialData` record into a normalized row. */
export function normalizeScrapedRecord(
  raw: Record<string, unknown>,
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): TrendshiftRepo {
  const fullName = str(raw.full_name);
  return {
    periodKey: derivePeriodKey(timeframe, raw),
    rank: numOrNull(raw.rank) ?? 0,
    score: numOrNull(raw.score),
    fullName,
    githubUrl: `https://github.com/${fullName}`,
    description: str(raw.repository_description ?? raw.description),
    language: str(raw.repository_language ?? raw.language) || null,
    starsTotal: numOrNull(raw.repository_stars ?? raw.stars_total),
    starsGained: numOrNull(raw.repository_stars_gained ?? raw.stars_gained),
    forksTotal: numOrNull(raw.repository_forks ?? raw.forks_total),
    forksGained: numOrNull(raw.repository_forks_gained ?? raw.forks_gained),
    createdAt: str(raw.repository_created_at ?? raw.created_at) || null,
    tags: tagSlugs(raw.tags),
    socialMentionPlatforms: platformNames(raw.social_mention_platforms),
    timeframe,
    languageFilter: language,
  };
}

// ---------------------------------------------------------------------------
// RSC flight parsing (clean-room)
// ---------------------------------------------------------------------------

/** Find the JSON array following `"initialData":` in a Next.js RSC flight body. */
export function parseInitialData(
  body: string,
): Record<string, unknown>[] | null {
  const direct = extractAfterMarker(body);
  if (direct) return direct;

  // Some flight rows embed escaped JSON inside a `0:"…"` string row.
  const rowRe = /^\d+:"((?:[^"\\]|\\.)*)"$/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(body)) !== null) {
    let unescaped: string;
    try {
      unescaped = JSON.parse(`"${m[1]}"`) as string;
    } catch {
      continue;
    }
    const found = extractAfterMarker(unescaped);
    if (found) return found;
  }
  return null;
}

function extractAfterMarker(text: string): Record<string, unknown>[] | null {
  const marker = '"initialData":';
  const idx = text.indexOf(marker);
  if (idx < 0) return null;
  const start = text.indexOf("[", idx + marker.length);
  if (start < 0) return null;
  const end = matchBracket(text, start);
  if (end < 0) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : null;
  } catch {
    return null;
  }
}

/** Bracket-match a JSON array/object starting at `start`; return end index. */
function matchBracket(text: string, start: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchText(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 30000,
): Promise<string> {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJson<T>(url: string, timeoutMs = 30000): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1)
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

export async function fetchCdnSlice(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): Promise<TrendshiftRepo[]> {
  const url = `${TRENDSHIFT_CDN_BASE}/${timeframe}/${sliceFileName(timeframe, language)}`;
  const raw = await retry(() => fetchJson<Record<string, unknown>[]>(url));
  if (!Array.isArray(raw))
    throw new Error(`Unexpected payload shape from ${url}`);
  return raw.map((r) => normalizeCdnRecord(r, timeframe, language));
}

function scrapeUrl(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): string {
  const path = timeframe === "daily" ? "" : timeframe;
  const base = `${TRENDSHIFT_SCRAPE_BASE}/${path}`;
  return language === "all"
    ? base
    : `${base}?language=${encodeURIComponent(TRENDSHIFT_LANGUAGE_LABELS[language])}`;
}

export async function scrapeSlice(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
): Promise<TrendshiftRepo[]> {
  const url = scrapeUrl(timeframe, language);
  const body = await retry(() =>
    fetchText(url, { RSC: "1", "User-Agent": USER_AGENT }),
  );
  const rows = parseInitialData(body);
  if (!rows)
    throw new Error(`initialData not found in RSC response from ${url}`);
  return rows.map((r) => normalizeScrapedRecord(r, timeframe, language));
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<{ item: T; result?: R; error?: unknown }[]> {
  const out: { item: T; result?: R; error?: unknown }[] = [];
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        const item = items[idx];
        try {
          out[idx] = { item, result: await fn(item) };
        } catch (error) {
          out[idx] = { item, error };
        }
      }
    },
  );
  await Promise.all(workers);
  return out;
}

// ---------------------------------------------------------------------------
// Read helpers (local store first, live CDN fallback)
// ---------------------------------------------------------------------------

export interface TrendshiftSlicePayload {
  timeframe: TrendshiftTimeframe;
  language: TrendshiftLanguageFilter;
  count: number;
  items: TrendshiftRepo[];
  /** Where the rows came from: local store or live CDN. */
  source: "local" | "cdn";
}

export function getTrendshiftOverview() {
  const manifest = readTrendshiftManifest();
  return {
    timeframes: TRENDSHIFT_TIMEFRAMES,
    languages: TRENDSHIFT_LANGUAGES,
    labels: TRENDSHIFT_LANGUAGE_LABELS,
    updatedAt: manifest?.updatedAt ?? null,
    origin: manifest?.origin ?? null,
    files: manifest?.files ?? [],
  };
}

export async function getTrendshiftSliceData(
  timeframe: TrendshiftTimeframe,
  language: TrendshiftLanguageFilter,
  period?: string,
): Promise<TrendshiftSlicePayload> {
  let items = readTrendshiftSlice(timeframe, language);
  let source: "local" | "cdn" = "local";
  if (!items) {
    items = await fetchCdnSlice(timeframe, language);
    source = "cdn";
  }
  if (period) items = items.filter((r) => r.periodKey === period);
  return { timeframe, language, count: items.length, items, source };
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export async function syncTrendshift(
  options: TrendshiftSyncOptions = {},
): Promise<TrendshiftSyncSummary> {
  const timeframes = options.timeframes?.length
    ? options.timeframes
    : [...TRENDSHIFT_TIMEFRAMES];
  const languages = options.languages?.length
    ? options.languages
    : (["all"] as TrendshiftLanguageFilter[]);
  const sourceMode = options.source ?? "cdn";
  const save = options.save !== false;
  const concurrency = options.concurrency ?? 8;

  const slices = timeframes.flatMap((tf) =>
    languages.map((lang) => ({ tf, lang })),
  );

  const originUsed: TrendshiftSource =
    sourceMode === "scrape" ? "scrape" : "cdn";
  let totalRows = 0;
  let bytes = 0;
  const files: TrendshiftManifestFile[] = [];
  const failures: string[] = [];

  const results = await mapPool(slices, concurrency, async ({ tf, lang }) => {
    let rows: TrendshiftRepo[];
    let origin: TrendshiftSource;
    if (sourceMode === "scrape") {
      rows = await scrapeSlice(tf, lang);
      origin = "scrape";
    } else {
      try {
        rows = await fetchCdnSlice(tf, lang);
        origin = "cdn";
      } catch (cdnErr) {
        if (sourceMode === "cdn") throw cdnErr;
        rows = await scrapeSlice(tf, lang);
        origin = "scrape";
      }
    }
    return { tf, lang, rows, origin };
  });

  for (const entry of results) {
    if (entry.error || !entry.result) {
      failures.push(
        `${entry.item.tf}-${entry.item.lang}: ${String(entry.error)}`,
      );
      continue;
    }
    const { tf, lang, rows, origin } = entry.result;
    // Scrape yields only the current period — merge to keep history slices.
    const merged =
      origin === "scrape"
        ? mergeSliceRows(readTrendshiftSlice(tf, lang) ?? [], rows)
        : rows;
    if (save) {
      const saved = saveTrendshiftSlice(tf, lang, merged, origin);
      bytes += saved.bytes;
    } else {
      bytes += Buffer.byteLength(JSON.stringify(merged), "utf-8");
    }
    totalRows += merged.length;
    files.push({
      path: sliceRelPath(tf, lang),
      timeframe: tf,
      language: lang,
      count: merged.length,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (failures.length) {
    console.error(`[trendshift] ${failures.length} slice(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
  }

  return {
    origin: originUsed,
    outDir: getTrendshiftDir(),
    files,
    totalRows,
    bytes,
  };
}

// ---------------------------------------------------------------------------
// Direct run
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): TrendshiftSyncOptions & { help?: boolean } {
  const options: TrendshiftSyncOptions & { help?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--timeframe" && argv[i + 1]) {
      const vals = argv[++i].split(",").map((s) => s.trim());
      options.timeframes = vals.includes("all")
        ? [...TRENDSHIFT_TIMEFRAMES]
        : (vals as TrendshiftTimeframe[]);
    } else if (arg === "--language" && argv[i + 1]) {
      const vals = argv[++i].split(",").map((s) => s.trim().toLowerCase());
      options.languages = vals.includes("*")
        ? [...TRENDSHIFT_LANGUAGES]
        : (vals as TrendshiftLanguageFilter[]);
    } else if (arg === "--source" && argv[i + 1]) {
      options.source = argv[++i] as TrendshiftSource | "auto";
    } else if (arg === "--no-save") {
      options.save = false;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /trendshift\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      `Usage: bunx tsx src/collector/trendshift.ts [--timeframe daily|weekly|monthly|yearly|all] [--language slug[,slug]|*] [--source cdn|scrape|auto] [--no-save]`,
    );
    process.exit(0);
  }
  syncTrendshift(opts)
    .then((summary) =>
      console.log(
        JSON.stringify(
          {
            origin: summary.origin,
            files: summary.files.map((f) => `${f.path} (${f.count})`),
            totalRows: summary.totalRows,
            bytes: summary.bytes,
            outDir: summary.outDir,
          },
          null,
          2,
        ),
      ),
    )
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
