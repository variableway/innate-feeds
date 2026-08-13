import type { FeedFilters } from "@/types/feed";

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "innate-feeds:filters";

type PersistedFeedFilters = Pick<
  FeedFilters,
  "topics" | "language" | "search" | "date" | "starsMin" | "starsMax"
>;

interface StoredPayload {
  version: number;
  filters: PersistedFeedFilters;
}

function storageKey(feedType: "trending" | "starred"): string {
  return `${STORAGE_PREFIX}:v${STORAGE_VERSION}:${feedType}`;
}

function sanitizePersistedFilters(raw: unknown): PersistedFeedFilters | null {
  if (!raw || typeof raw !== "object") return null;

  const input = raw as Record<string, unknown>;
  const filters: PersistedFeedFilters = {};

  if (Array.isArray(input.topics)) {
    const topics = input.topics.filter(
      (topic): topic is string =>
        typeof topic === "string" && topic.trim().length > 0,
    );
    if (topics.length > 0) filters.topics = topics;
  }

  if (typeof input.language === "string" && input.language.trim()) {
    filters.language = input.language;
  }

  if (typeof input.search === "string" && input.search.trim()) {
    filters.search = input.search;
  }

  if (typeof input.date === "string" && input.date.trim()) {
    filters.date = input.date;
  }

  if (typeof input.starsMin === "number" && !Number.isNaN(input.starsMin)) {
    filters.starsMin = input.starsMin;
  }

  if (typeof input.starsMax === "number" && !Number.isNaN(input.starsMax)) {
    filters.starsMax = input.starsMax;
  }

  return Object.keys(filters).length > 0 ? filters : null;
}

function pickPersistedFilters(filters: FeedFilters): PersistedFeedFilters {
  const persisted: PersistedFeedFilters = {};

  if (filters.topics?.length) persisted.topics = filters.topics;
  if (filters.language) persisted.language = filters.language;
  if (filters.search) persisted.search = filters.search;
  if (filters.date) persisted.date = filters.date;
  if (filters.starsMin != null) persisted.starsMin = filters.starsMin;
  if (filters.starsMax != null) persisted.starsMax = filters.starsMax;

  return persisted;
}

export function loadPersistedFeedFilters(
  feedType: "trending" | "starred",
  defaults: FeedFilters,
): FeedFilters {
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(storageKey(feedType));
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed.version !== STORAGE_VERSION) return defaults;

    const persisted = sanitizePersistedFilters(parsed.filters);
    if (!persisted) return defaults;

    return { ...defaults, ...persisted };
  } catch {
    return defaults;
  }
}

export function savePersistedFeedFilters(
  feedType: "trending" | "starred",
  filters: FeedFilters,
): void {
  if (typeof window === "undefined") return;

  const persisted = pickPersistedFilters(filters);
  const key = storageKey(feedType);

  try {
    if (Object.keys(persisted).length === 0) {
      localStorage.removeItem(key);
      return;
    }

    const payload: StoredPayload = {
      version: STORAGE_VERSION,
      filters: persisted,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded or private mode — ignore and keep in-memory state only.
  }
}

export function clearPersistedFeedFilters(
  feedType: "trending" | "starred",
): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(feedType));
}
