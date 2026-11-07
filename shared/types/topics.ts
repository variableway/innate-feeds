/**
 * GitHub Topics datasource contract (S0, GH #24).
 * 单一真相：后端 topics-store 与前端 types/topics.ts 均 re-export。
 */

/** Repo shape served to the frontend (mirrors `GitHubRepo` + topic flags). */
export interface TopicRepo {
  id: string;
  repoId: number;
  fullName: string;
  name: string;
  description: string;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  language: string | null;
  topics: string[];
  owner: { login: string; avatarUrl: string; url: string };
  createdAt: string;
  updatedAt: string;
  /** First time the repo showed up in this topic. */
  firstSeenAt: string;
  /** New in the latest sync of this topic. */
  isNew: boolean;
  /** Already present in the trending/starred feeds. */
  existing: boolean;
}

export interface TopicSummary {
  topic: string;
  /** Repos in the topic snapshot. */
  count: number;
  /** New discoveries (first seen in the latest sync, not in the feeds). */
  newCount: number;
  /** Repos that already exist in the trending/starred feeds. */
  existingCount: number;
  fetchedAt: string;
}

/** GET /api/topics 响应 */
export interface TopicsIndexResponse {
  topics: TopicSummary[];
  updatedAt: string | null;
}

/** GET /api/topics/:topic 响应 */
export interface TopicResponse {
  topic: string;
  fetchedAt: string;
  count: number;
  newCount: number;
  existingCount: number;
  items: TopicRepo[];
}
