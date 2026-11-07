/**
 * Feeds types.
 * S0：wire 契约（GitHubRepo / FeedItem / FeedResponse / FeedStats / FeedFilters）
 * 收敛至根 shared/types/feeds，此处 re-export；digest 与 README 类型暂留本地
 * （S0 范围未含 digest，待后续步骤收敛）。
 */

import type { FeedFilters } from "../../../shared/types/feeds";

export type {
  GitHubRepo,
  FeedItem,
  FeedResponse,
  FeedStats,
  FeedFilters,
} from "../../../shared/types/feeds";

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

export type DigestSourceId = "ruanyf-weekly" | "github-daily" | "hellogithub";

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
