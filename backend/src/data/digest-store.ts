/**
 * Load digest items from local JSON dumps (~/.innate/digest or repo data/digest).
 * v1: no SQLite — serves the newest combined dump for API list/detail.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getDefaultDigestDir,
  type DigestItemLocal,
  type DigestSourceId,
} from "../collector/issues-digest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Relative to this module: backend/src/data → backend/data/digest */
const REPO_DIGEST_DIR = join(__dirname, "../../data/digest");

export interface DigestFeedItemDTO {
  id: string;
  type: "digest";
  source: DigestSourceId;
  sourceRepo: string;
  title: string;
  category: string | null;
  excerpt: string;
  bodyMarkdown?: string | null;
  primaryUrl: string | null;
  githubRepoFullName: string | null;
  issueUrl: string;
  authorLogin: string;
  authorAvatarUrl: string | null;
  issueCreatedAt: string;
  issueUpdatedAt: string;
  labels: string[];
  comments: number;
  state: string;
  fetchedAt: string;
}

export interface DigestListFilters {
  search?: string;
  source?: string;
  category?: string;
  sort?: string;
  order?: string;
  hasPrimaryUrl?: boolean;
}

export interface DigestListResult {
  items: DigestFeedItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  sources: { id: DigestSourceId; repo: string; count: number }[];
  fetchedAt: string | null;
}

interface DigestFilePayload {
  fetchedAt?: string;
  count?: number;
  items?: DigestItemLocal[];
}

let cache: {
  path: string;
  mtimeMs: number;
  fetchedAt: string;
  items: DigestItemLocal[];
} | null = null;

function candidateDirs(): string[] {
  const envDir = process.env.DIGEST_DIR?.trim();
  const cwd = process.cwd();
  const dirs = [
    envDir || null,
    getDefaultDigestDir(),
    REPO_DIGEST_DIR,
    // When cwd is backend/ or repo root during `bun run dev` / CLI
    join(cwd, "data/digest"),
    join(cwd, "backend/data/digest"),
  ].filter((d): d is string => Boolean(d));
  return [...new Set(dirs.filter((d) => existsSync(d)))];
}

/** Prefer combined dumps (no `__source` / `.summary` suffix). */
function listCombinedDumpPaths(): string[] {
  const paths: string[] = [];
  for (const dir of candidateDirs()) {
    for (const name of readdirSync(dir)) {
      if (!name.startsWith("digest-") || !name.endsWith(".json")) continue;
      if (name.includes(".summary.")) continue;
      if (name.includes("__")) continue;
      paths.push(join(dir, name));
    }
  }
  return paths;
}

function pickNewestDump(): string | null {
  const paths = listCombinedDumpPaths();
  if (paths.length === 0) return null;
  paths.sort((a, b) => {
    const am = statSync(a).mtimeMs;
    const bm = statSync(b).mtimeMs;
    if (am !== bm) return bm - am;
    return b.localeCompare(a);
  });
  return paths[0] ?? null;
}

function loadItems(): {
  items: DigestItemLocal[];
  fetchedAt: string;
  path: string;
} | null {
  const path = pickNewestDump();
  if (!path) return null;

  const mtimeMs = statSync(path).mtimeMs;
  if (cache && cache.path === path && cache.mtimeMs === mtimeMs) {
    return { items: cache.items, fetchedAt: cache.fetchedAt, path };
  }

  const raw = JSON.parse(readFileSync(path, "utf-8")) as DigestFilePayload;
  const items = Array.isArray(raw.items) ? raw.items : [];
  const fetchedAt = raw.fetchedAt || new Date(mtimeMs).toISOString();
  cache = { path, mtimeMs, fetchedAt, items };
  return { items, fetchedAt, path };
}

function toListDTO(
  item: DigestItemLocal,
  fetchedAt: string,
  includeBody: boolean,
): DigestFeedItemDTO {
  return {
    id: item.id,
    type: "digest",
    source: item.source,
    sourceRepo: item.sourceRepo,
    title: item.title,
    category: item.category,
    excerpt: item.bodyExcerpt,
    ...(includeBody ? { bodyMarkdown: item.bodyMarkdown } : {}),
    primaryUrl: item.primaryUrl,
    githubRepoFullName: item.githubRepoFullName,
    issueUrl: item.issueUrl,
    authorLogin: item.authorLogin,
    authorAvatarUrl: item.authorAvatarUrl || null,
    issueCreatedAt: item.issueCreatedAt,
    issueUpdatedAt: item.issueUpdatedAt,
    labels: item.labels ?? [],
    comments: item.comments ?? 0,
    state: item.state,
    fetchedAt,
  };
}

function applyFilters(
  items: DigestItemLocal[],
  filters: DigestListFilters,
): DigestItemLocal[] {
  let next = items;

  if (filters.source && filters.source !== "all") {
    next = next.filter((i) => i.source === filters.source);
  }

  if (filters.category) {
    if (filters.category === "__uncategorized__") {
      next = next.filter((i) => !i.category);
    } else {
      next = next.filter((i) => i.category === filters.category);
    }
  }

  if (filters.hasPrimaryUrl) {
    next = next.filter((i) => Boolean(i.primaryUrl));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    next = next.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.bodyExcerpt.toLowerCase().includes(q) ||
        i.authorLogin.toLowerCase().includes(q) ||
        (i.category?.toLowerCase().includes(q) ?? false),
    );
  }

  const sort = filters.sort || "created";
  const order = filters.order || "desc";
  const mult = order === "asc" ? 1 : -1;

  next = [...next].sort((a, b) => {
    let av: string | number;
    let bv: string | number;
    switch (sort) {
      case "updated":
        av = a.issueUpdatedAt;
        bv = b.issueUpdatedAt;
        break;
      case "comments":
        av = a.comments;
        bv = b.comments;
        break;
      default:
        av = a.issueCreatedAt;
        bv = b.issueCreatedAt;
    }
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });

  return next;
}

function aggregateMeta(items: DigestItemLocal[]): {
  categories: string[];
  sources: { id: DigestSourceId; repo: string; count: number }[];
} {
  const categoryCounts = new Map<string, number>();
  const sourceCounts = new Map<
    DigestSourceId,
    { repo: string; count: number }
  >();

  for (const item of items) {
    const cat = item.category || "__uncategorized__";
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);

    const existing = sourceCounts.get(item.source);
    if (existing) {
      existing.count += 1;
    } else {
      sourceCounts.set(item.source, { repo: item.sourceRepo, count: 1 });
    }
  }

  const categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  const sources = [...sourceCounts.entries()].map(([id, v]) => ({
    id,
    repo: v.repo,
    count: v.count,
  }));

  return { categories, sources };
}

export function getDigestFeedItems(
  filters: DigestListFilters = {},
  page = 1,
  pageSize = 20,
): DigestListResult {
  const loaded = loadItems();
  if (!loaded) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      categories: [],
      sources: [],
      fetchedAt: null,
    };
  }

  const { categories, sources } = aggregateMeta(loaded.items);
  const filtered = applyFilters(loaded.items, filters);
  const total = filtered.length;
  const start = Math.max(0, (page - 1) * pageSize);
  const slice = filtered.slice(start, start + pageSize);

  return {
    items: slice.map((i) => toListDTO(i, loaded.fetchedAt, false)),
    total,
    page,
    pageSize,
    categories,
    sources,
    fetchedAt: loaded.fetchedAt,
  };
}

export function getDigestItemById(id: string): DigestFeedItemDTO | null {
  const loaded = loadItems();
  if (!loaded) return null;
  const item = loaded.items.find((i) => i.id === id);
  if (!item) return null;
  return toListDTO(item, loaded.fetchedAt, true);
}
