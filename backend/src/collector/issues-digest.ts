/**
 * Fetch + normalize GitHub Issues boards into digest items; optional local JSON persist.
 *
 * Design: docs/project/features/feeds-issues-digest.md
 * Standalone — does NOT write SQLite or touch sync.ts / server.ts / schema.sql.
 *
 * Run (from backend/):
 *   bunx tsx src/collector/issues-digest.ts --since 2026-08-01 --save
 *   bun run export:digest-local -- --since 2026-08-01
 *   bunx tsx src/app/cli.ts sync digest --since 2026-08-01
 */

import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { DEFAULT_SYNC_WINDOW_DAYS, dateDaysAgo } from "../data/date-window.js";

export type DigestSourceId = "ruanyf-weekly" | "github-daily";

export interface DigestSourceConfig {
  id: DigestSourceId;
  repo: string; // owner/name
}

export const DIGEST_SOURCES: DigestSourceConfig[] = [
  { id: "ruanyf-weekly", repo: "ruanyf/weekly" },
  { id: "github-daily", repo: "GitHubDaily/GitHubDaily" },
];

export interface DigestIssueRaw {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  comments: number;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  labels: { name: string }[];
  pull_request?: unknown;
}

export interface DigestItem {
  id: string;
  source: DigestSourceId;
  sourceRepo: string;
  issueNumber: number;
  issueId: number;
  title: string;
  category: string | null;
  bodyExcerpt: string;
  primaryUrl: string | null;
  githubRepoFullName: string | null;
  authorLogin: string;
  authorAvatarUrl: string;
  issueUrl: string;
  state: string;
  labels: string[];
  comments: number;
  issueCreatedAt: string;
  issueUpdatedAt: string;
}

/** Local dump row — includes full markdown body for offline archive. */
export interface DigestItemLocal extends DigestItem {
  bodyMarkdown: string | null;
}

const CATEGORY_RE = /^[\[【]([^\]】]+)[\]】]/;
const URL_RE = /https?:\/\/[^\s)\]>"'<]+/g;
const GH_REPO_RE =
  /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[\/?#]|$)/i;

const USER_AGENT =
  "innate-feeds/0.1 (+https://github.com/variableway/innate-feeds)";

function toIsoSince(input: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return `${input}T00:00:00Z`;
  }
  return input;
}

function ghApiJsonViaCli(apiPath: string): unknown {
  const raw = execFileSync("gh", ["api", apiPath], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

async function ghApiJsonViaFetch(apiPath: string): Promise<unknown> {
  const url = `https://api.github.com/${apiPath.replace(/^\//, "")}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GitHub API HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`,
    );
  }
  return res.json();
}

/**
 * Prefer `gh api` (authenticated rate limits). Fall back to public REST via
 * fetch when gh fails (e.g. invalid keyring token) — public Issues boards still work.
 */
export async function ghApiJson(apiPath: string): Promise<unknown> {
  try {
    return ghApiJsonViaCli(apiPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[digest] gh api failed (${msg.split("\n")[0]}); falling back to public fetch`,
    );
    return ghApiJsonViaFetch(apiPath);
  }
}

export function parseCategory(title: string): string | null {
  const m = title.match(CATEGORY_RE);
  return m ? m[1].trim() : null;
}

function stripTrailingPunct(url: string): string {
  return url.replace(/[.,;:）)】»"']+$/g, "").replace(/&amp;/g, "&");
}

export function extractUrls(body: string | null): string[] {
  if (!body) return [];
  const found = body.match(URL_RE) ?? [];
  return [...new Set(found.map(stripTrailingPunct))];
}

function isAttachmentOrMeta(url: string): boolean {
  return (
    /github\.com\/user-attachments\//i.test(url) ||
    /camo\.githubusercontent\.com/i.test(url) ||
    /avatars\.githubusercontent\.com/i.test(url)
  );
}

export function parseGithubRepoFullName(url: string): string | null {
  const m = url.match(GH_REPO_RE);
  if (!m) return null;
  const full = `${m[1]}/${m[2]}`;
  if (/^(issues|pull|discussions|actions|wiki|releases)$/i.test(m[2])) {
    return null;
  }
  return full;
}

export function pickPrimaryLink(
  urls: string[],
  sourceRepo: string,
): { primaryUrl: string | null; githubRepoFullName: string | null } {
  const usable = urls.filter((u) => !isAttachmentOrMeta(u));
  let githubRepoFullName: string | null = null;
  let primaryUrl: string | null = null;

  for (const u of usable) {
    const full = parseGithubRepoFullName(u);
    if (full && full.toLowerCase() !== sourceRepo.toLowerCase()) {
      githubRepoFullName = full;
      primaryUrl = `https://github.com/${full}`;
      break;
    }
  }

  if (!primaryUrl && usable.length > 0) {
    primaryUrl = usable[0];
  }

  return { primaryUrl, githubRepoFullName };
}

export function excerptBody(body: string | null, maxLen = 280): string {
  if (!body) return "";
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`;
}

export function normalizeIssue(
  source: DigestSourceConfig,
  issue: DigestIssueRaw,
): DigestItem | null {
  if (issue.pull_request) return null;

  const urls = extractUrls(issue.body);
  const { primaryUrl, githubRepoFullName } = pickPrimaryLink(urls, source.repo);

  return {
    id: `digest-${source.id}-${issue.id}`,
    source: source.id,
    sourceRepo: source.repo,
    issueNumber: issue.number,
    issueId: issue.id,
    title: issue.title,
    category: parseCategory(issue.title),
    bodyExcerpt: excerptBody(issue.body),
    primaryUrl,
    githubRepoFullName,
    authorLogin: issue.user.login,
    authorAvatarUrl: issue.user.avatar_url,
    issueUrl: issue.html_url,
    state: issue.state,
    labels: (issue.labels ?? []).map((l) => l.name),
    comments: issue.comments ?? 0,
    issueCreatedAt: issue.created_at,
    issueUpdatedAt: issue.updated_at,
  };
}

export function toLocalItem(
  source: DigestSourceConfig,
  issue: DigestIssueRaw,
): DigestItemLocal | null {
  const base = normalizeIssue(source, issue);
  if (!base) return null;
  return { ...base, bodyMarkdown: issue.body ?? null };
}

export interface FetchDigestOptions {
  /** ISO8601 or YYYY-MM-DD — passed to Issues API `since` (filters by updated_at). */
  since?: string;
  /** ISO8601 or YYYY-MM-DD — client-side upper bound on created_at (exclusive if date-only). */
  until?: string;
  /**
   * When true with `since`, keep only issues with created_at >= since
   * (drops older issues that were merely updated in-range).
   */
  createdOnly?: boolean;
  perPage?: number;
  /** Hard cap on pages per source (default 20 ≈ 2000 issues). */
  maxPages?: number;
  state?: "open" | "closed" | "all";
  sources?: DigestSourceConfig[];
}

export interface DigestFetchResult {
  fetchedAt: string;
  since?: string;
  until?: string;
  createdOnly: boolean;
  transport: "gh" | "fetch" | "mixed";
  items: DigestItemLocal[];
  bySource: Record<
    string,
    { fetched: number; kept: number; pages: number; prsSkipped: number }
  >;
}

function normalizeUntil(until?: string): string | undefined {
  if (!until) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return `${until}T00:00:00Z`;
  }
  return until;
}

function inDateWindow(
  issue: DigestIssueRaw,
  sinceIso: string | undefined,
  untilIso: string | undefined,
  createdOnly: boolean,
): boolean {
  if (untilIso && issue.created_at >= untilIso) return false;
  if (createdOnly && sinceIso && issue.created_at < sinceIso) return false;
  return true;
}

export async function fetchDigestIssues(
  options: FetchDigestOptions = {},
): Promise<DigestFetchResult> {
  const {
    perPage = 100,
    maxPages = 20,
    state = "all",
    sources = DIGEST_SOURCES,
    createdOnly = false,
  } = options;

  const sinceIso = options.since ? toIsoSince(options.since) : undefined;
  const untilIso = normalizeUntil(options.until);

  const items: DigestItemLocal[] = [];
  const bySource: DigestFetchResult["bySource"] = {};
  let usedGh = false;
  let usedFetch = false;

  for (const source of sources) {
    let pages = 0;
    let fetched = 0;
    let kept = 0;
    let prsSkipped = 0;

    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams({
        state,
        per_page: String(Math.min(100, Math.max(1, perPage))),
        page: String(page),
        sort: sinceIso ? "updated" : "created",
        direction: "desc",
      });
      if (sinceIso) params.set("since", sinceIso);

      const apiPath = `repos/${source.repo}/issues?${params.toString()}`;
      console.error(`[digest] GET ${apiPath}`);

      let raw: unknown;
      try {
        raw = ghApiJsonViaCli(apiPath);
        usedGh = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[digest] gh api failed (${msg.split("\n")[0]}); falling back to public fetch`,
        );
        raw = await ghApiJsonViaFetch(apiPath);
        usedFetch = true;
      }

      if (!Array.isArray(raw) || raw.length === 0) break;
      pages = page;

      for (const row of raw as DigestIssueRaw[]) {
        if (row.pull_request) {
          prsSkipped += 1;
          continue;
        }
        fetched += 1;
        if (!inDateWindow(row, sinceIso, untilIso, createdOnly)) continue;
        const item = toLocalItem(source, row);
        if (!item) continue;
        kept += 1;
        items.push(item);
      }

      if (raw.length < perPage) break;
      // With `since` + sort=updated, continue until the API returns a short page.
      // Do not stop on created_at — older issues can appear mid-stream when bumped.
    }

    bySource[source.id] = { fetched, kept, pages, prsSkipped };
  }

  // Dedupe by id (defensive across pages)
  const deduped = [...new Map(items.map((i) => [i.id, i])).values()];

  deduped.sort((a, b) =>
    a.issueCreatedAt < b.issueCreatedAt
      ? 1
      : a.issueCreatedAt > b.issueCreatedAt
        ? -1
        : 0,
  );

  const transport: DigestFetchResult["transport"] =
    usedGh && usedFetch ? "mixed" : usedGh ? "gh" : "fetch";

  return {
    fetchedAt: new Date().toISOString(),
    since: sinceIso,
    until: untilIso,
    createdOnly,
    transport,
    items: deduped,
    bySource,
  };
}

export function getDefaultDigestDir(): string {
  const override = process.env.DIGEST_DIR?.trim();
  if (override) return override;
  const home = process.env.INNATE_HOME || join(homedir(), ".innate");
  return join(home, "digest");
}

export interface SaveDigestOptions {
  /** Directory to write into (default ~/.innate/digest). */
  outDir?: string;
  /** Filename stem override; default derived from since/until/fetchedAt. */
  basename?: string;
  /** Also write per-source files. */
  splitBySource?: boolean;
}

export interface SaveDigestResult {
  outDir: string;
  files: string[];
  count: number;
  bytes: number;
}

function dateLabel(iso?: string): string | undefined {
  if (!iso) return undefined;
  return iso.slice(0, 10);
}

export function saveDigestLocal(
  result: DigestFetchResult,
  options: SaveDigestOptions = {},
): SaveDigestResult {
  const outDir = options.outDir || getDefaultDigestDir();
  mkdirSync(outDir, { recursive: true });

  const sinceLabel = dateLabel(result.since);
  const untilLabel = dateLabel(result.until);
  const stem =
    options.basename ||
    (sinceLabel
      ? `digest-${sinceLabel}${untilLabel ? `_to_${untilLabel}` : ""}`
      : `digest-${result.fetchedAt.replace(/[:.]/g, "-")}`);

  const payload = {
    fetchedAt: result.fetchedAt,
    since: result.since ?? null,
    until: result.until ?? null,
    createdOnly: result.createdOnly,
    transport: result.transport,
    bySource: result.bySource,
    count: result.items.length,
    items: result.items,
  };

  const files: string[] = [];
  let bytes = 0;

  const allPath = join(outDir, `${stem}.json`);
  const allJson = JSON.stringify(payload, null, 2);
  writeFileSync(allPath, allJson, "utf-8");
  files.push(allPath);
  bytes += Buffer.byteLength(allJson, "utf-8");

  if (options.splitBySource !== false) {
    for (const source of DIGEST_SOURCES) {
      const subset = result.items.filter((i) => i.source === source.id);
      if (subset.length === 0) continue;
      const part = {
        ...payload,
        source: source.id,
        sourceRepo: source.repo,
        count: subset.length,
        items: subset,
      };
      const partPath = join(outDir, `${stem}__${source.id}.json`);
      const partJson = JSON.stringify(part, null, 2);
      writeFileSync(partPath, partJson, "utf-8");
      files.push(partPath);
      bytes += Buffer.byteLength(partJson, "utf-8");
    }
  }

  const summaryPath = join(outDir, `${stem}.summary.json`);
  const summary = {
    fetchedAt: result.fetchedAt,
    since: result.since ?? null,
    until: result.until ?? null,
    createdOnly: result.createdOnly,
    transport: result.transport,
    count: result.items.length,
    bySource: result.bySource,
    files,
  };
  const summaryJson = JSON.stringify(summary, null, 2);
  writeFileSync(summaryPath, summaryJson, "utf-8");
  files.push(summaryPath);
  bytes += Buffer.byteLength(summaryJson, "utf-8");

  return { outDir, files, count: result.items.length, bytes };
}

export interface DigestCliArgs {
  since?: string;
  until?: string;
  createdOnly: boolean;
  save: boolean;
  outDir?: string;
  maxPages: number;
  perPage: number;
  limit?: number;
  sources?: DigestSourceId[];
}

export function parseDigestArgs(argv: string[]): DigestCliArgs {
  let since: string | undefined;
  let until: string | undefined;
  let createdOnly = false;
  let save = false;
  let outDir: string | undefined;
  let maxPages = 20;
  let perPage = 100;
  let limit: number | undefined;
  let sources: DigestSourceId[] | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--since" && argv[i + 1]) since = argv[++i];
    else if (a === "--days" && argv[i + 1] && !since) {
      const days = Number(argv[++i]);
      since = dateDaysAgo(
        Number.isFinite(days) && days > 0 ? days : DEFAULT_SYNC_WINDOW_DAYS,
      );
      createdOnly = true;
    } else if (a === "--until" && argv[i + 1]) until = argv[++i];
    else if (a === "--created-only") createdOnly = true;
    else if (a === "--save" || a === "--export-local") save = true;
    else if ((a === "--out" || a === "--out-dir") && argv[i + 1])
      outDir = argv[++i];
    else if (a === "--max-pages" && argv[i + 1])
      maxPages = Number(argv[++i]) || maxPages;
    else if (a === "--per-page" && argv[i + 1])
      perPage = Number(argv[++i]) || perPage;
    else if (a === "--limit" && argv[i + 1])
      limit = Number(argv[++i]) || undefined;
    else if (a === "--source" && argv[i + 1]) {
      const id = argv[++i] as DigestSourceId;
      sources = sources ?? [];
      sources.push(id);
    }
  }

  return {
    since,
    until,
    createdOnly,
    save,
    outDir,
    maxPages,
    perPage,
    limit,
    sources,
  };
}

export async function runDigestExport(
  args: DigestCliArgs,
): Promise<{ result: DigestFetchResult; saved?: SaveDigestResult }> {
  const sourceConfigs = args.sources
    ? DIGEST_SOURCES.filter((s) => args.sources!.includes(s.id))
    : DIGEST_SOURCES;

  if (args.sources && sourceConfigs.length === 0) {
    throw new Error(
      `Unknown --source; expected one of: ${DIGEST_SOURCES.map((s) => s.id).join(", ")}`,
    );
  }

  const result = await fetchDigestIssues({
    since: args.since,
    until: args.until,
    createdOnly: args.createdOnly,
    perPage: args.perPage,
    maxPages: args.maxPages,
    state: "all",
    sources: sourceConfigs,
  });

  if (args.limit != null) {
    result.items = result.items.slice(0, args.limit);
  }

  let saved: SaveDigestResult | undefined;
  if (args.save) {
    saved = saveDigestLocal(result, { outDir: args.outDir });
  }

  return { result, saved };
}

async function main() {
  const args = parseDigestArgs(process.argv.slice(2));
  // Standalone default: print JSON; with --save also write files.
  // If neither --save nor --limit, still fetch (list remotely).
  const { result, saved } = await runDigestExport({
    ...args,
    // Default save when --out is set
    save: args.save || Boolean(args.outDir),
  });

  const summary = {
    fetchedAt: result.fetchedAt,
    since: result.since ?? null,
    until: result.until ?? null,
    createdOnly: result.createdOnly,
    transport: result.transport,
    count: result.items.length,
    bySource: result.bySource,
    saved: saved
      ? {
          outDir: saved.outDir,
          files: saved.files,
          bytes: saved.bytes,
        }
      : null,
    // Omit full bodies from stdout when saving large dumps
    items: saved
      ? result.items.map(({ bodyMarkdown: _b, ...rest }) => rest)
      : result.items,
  };

  console.log(JSON.stringify(summary, null, 2));
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /issues-digest\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
