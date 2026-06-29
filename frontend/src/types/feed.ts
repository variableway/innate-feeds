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
  topic?: string;
  search?: string;
  sort?: "stars" | "updated" | "created" | "starred";
  order?: "asc" | "desc";
  date?: string;
}

export interface FeedStats {
  totalRepos: number;
  trendingCount: number;
  starredCount: number;
  topLanguages: { name: string; count: number }[];
}
