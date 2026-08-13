import type {
  FeedResponse,
  FeedFilters,
  FeedStats,
  FeedItem,
  DigestFilters,
  DigestResponse,
  DigestFeedItem,
  RepoReadme,
} from "@/types/feed";
import {
  applyDigestFilters,
  fetchDigestDetailLive,
  fetchDigestLive,
  fetchRepoReadmeLive,
} from "./github-live";

const API_BASE = "/api";

const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");
const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";

interface StaticManifest {
  feeds?: {
    trending?: string[];
    starred?: string[];
  };
}

async function loadStaticManifest(): Promise<StaticManifest | null> {
  const res = await fetch(`${STATIC_BASE}/manifest.json`);
  if (!res.ok) return null;
  return res.json();
}

function getTrendingDatesFromManifest(manifest: StaticManifest | null): string[] {
  const paths = manifest?.feeds?.trending ?? [];
  return paths
    .map((path) => path.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
    .filter((date): date is string => Boolean(date))
    .sort()
    .reverse();
}

function getLatestTrendingSnapshotDate(items: FeedItem[]): string | null {
  const dates = items
    .map((item) => item.snapshotDate)
    .filter((date): date is string => Boolean(date));
  if (dates.length === 0) return null;
  return dates.sort().at(-1) ?? null;
}

async function loadOptionalStaticFeed(path: string): Promise<FeedResponse | null> {
  const res = await fetch(path);
  if (!res.ok) return null;
  return (await res.json()) as FeedResponse;
}

function mergeFeedItems(chunks: FeedResponse[]): FeedResponse {
  const byId = new Map<string, FeedItem>();
  for (const chunk of chunks) {
    for (const item of chunk.items) {
      const existing = byId.get(item.id);
      if (!existing || existing.fetchedAt < item.fetchedAt) {
        byId.set(item.id, item);
      }
    }
  }
  const items = Array.from(byId.values());
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: items.length,
  };
}

export function isStaticMode(): boolean {
  return IS_STATIC;
}

function applyFilters(
  data: FeedResponse,
  filters: FeedFilters,
  page: number,
  pageSize: number,
  feedType: "trending" | "starred" = "trending",
): FeedResponse {
  let items = [...data.items];

  if (filters.language) {
    items = items.filter((item) => item.repo.language === filters.language);
  }

  if (filters.topics?.length) {
    items = items.filter((item) =>
      filters.topics!.every((topic) => item.repo.topics.includes(topic)),
    );
  }

  if (filters.search) {
    const search = filters.search.toLowerCase();
    items = items.filter(
      (item) =>
        item.repo.fullName.toLowerCase().includes(search) ||
        item.repo.name.toLowerCase().includes(search) ||
        (item.repo.description &&
          item.repo.description.toLowerCase().includes(search)),
    );
  }

  if (filters.date) {
    items = items.filter((item) => item.snapshotDate === filters.date);
  } else if (feedType === "trending") {
    const latestDate = getLatestTrendingSnapshotDate(items);
    if (latestDate) {
      items = items.filter((item) => item.snapshotDate === latestDate);
    }
  }

  if (filters.starsMin != null) {
    items = items.filter((item) => item.repo.stars >= filters.starsMin!);
  }

  if (filters.starsMax != null) {
    items = items.filter((item) => item.repo.stars <= filters.starsMax!);
  }

  const sort = filters.sort || "stars";
  const order = filters.order || "desc";
  const multiplier = order === "asc" ? 1 : -1;

  items.sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sort) {
      case "updated":
        aValue = a.repo.updatedAt;
        bValue = b.repo.updatedAt;
        break;
      case "created":
        aValue = a.repo.createdAt;
        bValue = b.repo.createdAt;
        break;
      case "starred":
        aValue = a.starredAt || "";
        bValue = b.starredAt || "";
        break;
      default:
        aValue = a.repo.stars;
        bValue = b.repo.stars;
    }

    if (aValue < bValue) return -1 * multiplier;
    if (aValue > bValue) return 1 * multiplier;
    return 0;
  });

  const total = items.length;
  const start = (page - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);

  return { items: paginatedItems, total, page, pageSize };
}

export async function fetchFeeds(
  type: "trending" | "starred",
  filters: FeedFilters = {},
  page = 1,
  pageSize = 20,
): Promise<FeedResponse> {
  if (IS_STATIC) {
    const manifest = await loadStaticManifest();
    const chunkPaths = manifest?.feeds?.[type] ?? [];

    let data: FeedResponse;
    if (chunkPaths.length > 0) {
      const chunkFeeds = await Promise.all(
        chunkPaths.map(async (chunkPath) => {
          const res = await fetch(`${STATIC_BASE}/${chunkPath}`);
          if (!res.ok)
            throw new Error(`Failed to fetch static chunk: ${res.statusText}`);
          const chunkData = (await res.json()) as FeedResponse;
          return {
            items: chunkData.items ?? [],
            total: chunkData.total ?? chunkData.items?.length ?? 0,
            page: 1,
            pageSize: chunkData.items?.length ?? 0,
          } as FeedResponse;
        }),
      );
      const feedsToMerge: FeedResponse[] = [...chunkFeeds];

      // Keep compatibility with initial full snapshot files (especially starred.json).
      const baseFeed = await loadOptionalStaticFeed(`${STATIC_BASE}/${type}.json`);
      if (baseFeed) {
        feedsToMerge.unshift(baseFeed);
      }

      data = mergeFeedItems(feedsToMerge);
    } else {
      const res = await fetch(`${STATIC_BASE}/${type}.json`);
      if (!res.ok)
        throw new Error(`Failed to fetch static feeds: ${res.statusText}`);
      data = (await res.json()) as FeedResponse;
    }

    return applyFilters(data, filters, page, pageSize, type);
  }

  const params = new URLSearchParams({
    type,
    page: String(page),
    pageSize: String(pageSize),
  });

  if (filters.language) params.set("language", filters.language);
  if (filters.topics?.length) params.set("topics", filters.topics.join(","));
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.date) params.set("date", filters.date);
  if (filters.starsMin != null) params.set("starsMin", String(filters.starsMin));
  if (filters.starsMax != null) params.set("starsMax", String(filters.starsMax));

  const apiBase = API_BASE;
  const res = await fetch(`${apiBase}/feeds?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch feeds: ${res.statusText}`);
  return res.json();
}

export async function fetchStats(): Promise<FeedStats> {
  if (IS_STATIC) {
    const res = await fetch(`${STATIC_BASE}/stats.json`);
    if (!res.ok)
      throw new Error(`Failed to fetch static stats: ${res.statusText}`);
    return res.json();
  }

  const apiBase = API_BASE;
  const res = await fetch(`${apiBase}/feeds/stats`);
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.statusText}`);
  return res.json();
}

export async function fetchLanguages(): Promise<string[]> {
  if (IS_STATIC) {
    const res = await fetch(`${STATIC_BASE}/languages.json`);
    if (!res.ok)
      throw new Error(`Failed to fetch static languages: ${res.statusText}`);
    return res.json();
  }

  const apiBase = API_BASE;
  const res = await fetch(`${apiBase}/feeds/languages`);
  if (!res.ok) throw new Error(`Failed to fetch languages: ${res.statusText}`);
  return res.json();
}

export async function fetchDates(): Promise<string[]> {
  if (IS_STATIC) {
    const manifest = await loadStaticManifest();
    const fromManifest = getTrendingDatesFromManifest(manifest);
    if (fromManifest.length > 0) {
      return fromManifest;
    }

    const res = await fetch(`${STATIC_BASE}/dates.json`);
    if (!res.ok)
      throw new Error(`Failed to fetch static dates: ${res.statusText}`);
    return res.json();
  }

  const apiBase = API_BASE;
  const res = await fetch(`${apiBase}/feeds/dates`);
  if (!res.ok) throw new Error(`Failed to fetch dates: ${res.statusText}`);
  return res.json();
}

export async function syncFeeds(
  type: "trending" | "starred" | "all-trending",
  period?: "daily" | "weekly" | "monthly",
  force?: boolean,
  days?: number,
): Promise<any> {
  if (IS_STATIC) {
    throw new Error("Sync is not available in static/GitHub Pages mode");
  }

  const apiBase = API_BASE;
  const res = await fetch(`${apiBase}/feeds/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, period, force, days }),
  });
  if (!res.ok) throw new Error(`Failed to sync feeds: ${res.statusText}`);
  return res.json();
}

export async function fetchDigestFeeds(
  filters: DigestFilters = {},
  page = 1,
  pageSize = 20,
): Promise<DigestResponse> {
  if (IS_STATIC) {
    const live = await fetchDigestLive();
    return applyDigestFilters(live.items, filters, page, pageSize, live.fetchedAt);
  }

  try {
    const params = new URLSearchParams({
      type: "digest",
      page: String(page),
      pageSize: String(pageSize),
    });
    if (filters.search) params.set("search", filters.search);
    if (filters.source) params.set("source", filters.source);
    if (filters.category) params.set("category", filters.category);
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.order) params.set("order", filters.order);
    if (filters.hasPrimaryUrl) params.set("hasPrimaryUrl", "1");

    const res = await fetch(`${API_BASE}/feeds?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch digest: ${res.statusText}`);
    const data = (await res.json()) as DigestResponse;
    if ((data.total ?? 0) > 0 || data.fetchedAt) return data;
  } catch {
    /* backend dump missing — fall through to live GitHub */
  }

  const live = await fetchDigestLive();
  return applyDigestFilters(live.items, filters, page, pageSize, live.fetchedAt);
}

export async function fetchDigestDetail(
  id: string,
): Promise<DigestFeedItem> {
  if (IS_STATIC) {
    return fetchDigestDetailLive(id);
  }

  try {
    const res = await fetch(
      `${API_BASE}/feeds/digest/${encodeURIComponent(id)}`,
    );
    if (res.ok) return res.json();
  } catch {
    /* fall through */
  }
  return fetchDigestDetailLive(id);
}

export async function fetchRepoReadme(fullName: string): Promise<RepoReadme> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo full name: ${fullName}`);
  }

  if (!IS_STATIC) {
    try {
      const res = await fetch(
        `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
      );
      if (res.ok) return res.json();
    } catch {
      /* fall through to live GitHub */
    }
  }

  return fetchRepoReadmeLive(fullName);
}

export interface CachedReadmeListItem {
  owner: string;
  repo: string;
  fullName: string;
  relativePath: string;
  fetchedAt: string | null;
  size: number;
}

export async function fetchCachedReadmes(): Promise<{
  root: string;
  items: CachedReadmeListItem[];
}> {
  if (IS_STATIC) {
    return { root: "./readmes", items: [] };
  }
  const apiBase = API_BASE;
  const res = await fetch(`${apiBase}/readmes`);
  if (!res.ok) {
    throw new Error(`Failed to list cached READMEs: ${res.statusText}`);
  }
  return res.json();
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadRepoReadme(
  owner: string,
  repo: string,
): Promise<void> {
  const readme = await fetchRepoReadme(`${owner}/${repo}`);
  downloadTextFile(`${owner}-${repo}.md`, readme.markdown);
}
