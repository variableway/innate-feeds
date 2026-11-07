/**
 * Feeds wire contract (S0).
 * /api/feeds* 的载荷形状，单一真相；后端 DTO 与前端类型均 re-export。
 */

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
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
  starredAt?: string | null;
  fetchedAt?: string;
  repo: GitHubRepo;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FeedStats {
  totalRepos: number;
  trendingCount: number;
  starredCount: number;
  topLanguages: { name: string; count: number }[];
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
