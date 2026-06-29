export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  language: string | null;
  topics: string[];
  owner: {
    login: string;
    avatarUrl: string;
    url: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem {
  id: string;
  type: "trending" | "starred";
  snapshotDate?: string;
  repo: GitHubRepo;
  fetchedAt: string;
  starredAt?: string;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FeedFilters {
  language?: string;
  topics?: string[];
  search?: string;
  sort?: "stars" | "updated" | "created" | "starred";
  order?: "asc" | "desc";
  date?: string;
  starsMin?: number;
  starsMax?: number;
}

export function toggleTopicFilter(
  filters: FeedFilters,
  topic: string,
): FeedFilters {
  const topics = filters.topics ?? [];
  if (topics.includes(topic)) {
    const next = topics.filter((t) => t !== topic);
    return { ...filters, topics: next.length ? next : undefined };
  }
  return { ...filters, topics: [...topics, topic] };
}

export interface FeedStats {
  totalRepos: number;
  trendingCount: number;
  starredCount: number;
  topLanguages: { name: string; count: number }[];
}
