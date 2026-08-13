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

export type DigestSourceId = "ruanyf-weekly" | "github-daily";

export interface DigestFeedItem {
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
  /** Present when loaded live from GitHub Issues API. */
  issueNumber?: number;
}

export interface DigestFilters {
  search?: string;
  source?: DigestSourceId;
  category?: string;
  sort?: "created" | "updated" | "comments";
  order?: "asc" | "desc";
  hasPrimaryUrl?: boolean;
}

export interface DigestResponse {
  items: DigestFeedItem[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  sources: { id: DigestSourceId; repo: string; count: number }[];
  fetchedAt: string | null;
}

export interface RepoReadme {
  fullName: string;
  name: string;
  markdown: string;
  htmlUrl: string;
  encoding: string;
}
