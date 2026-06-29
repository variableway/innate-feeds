import type {
  FeedResponse,
  FeedFilters,
  FeedStats,
  FeedItem,
} from "@/types/feed";

const API_BASE = "/api";
const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");
const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";

export function isStaticMode(): boolean {
  return IS_STATIC;
}

function applyFilters(
  data: FeedResponse,
  filters: FeedFilters,
  page: number,
  pageSize: number,
): FeedResponse {
  let items = [...data.items];

  if (filters.language) {
    items = items.filter((item) => item.repo.language === filters.language);
  }

  if (filters.topic) {
    const topic = filters.topic;
    items = items.filter((item) => item.repo.topics.includes(topic));
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
    const res = await fetch(`${STATIC_BASE}/${type}.json`);
    if (!res.ok)
      throw new Error(`Failed to fetch static feeds: ${res.statusText}`);
    const data = (await res.json()) as FeedResponse;
    return applyFilters(data, filters, page, pageSize);
  }

  const params = new URLSearchParams({
    type,
    page: String(page),
    pageSize: String(pageSize),
  });

  if (filters.language) params.set("language", filters.language);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.date) params.set("date", filters.date);

  const res = await fetch(`${API_BASE}/feeds?${params}`);
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

  const res = await fetch(`${API_BASE}/feeds/stats`);
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

  const res = await fetch(`${API_BASE}/feeds/languages`);
  if (!res.ok) throw new Error(`Failed to fetch languages: ${res.statusText}`);
  return res.json();
}

export async function fetchDates(): Promise<string[]> {
  if (IS_STATIC) {
    const res = await fetch(`${STATIC_BASE}/dates.json`);
    if (!res.ok)
      throw new Error(`Failed to fetch static dates: ${res.statusText}`);
    return res.json();
  }

  const res = await fetch(`${API_BASE}/feeds/dates`);
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

  const res = await fetch(`${API_BASE}/feeds/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, period, force, days }),
  });
  if (!res.ok) throw new Error(`Failed to sync feeds: ${res.statusText}`);
  return res.json();
}
