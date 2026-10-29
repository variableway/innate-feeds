/**
 * GitHub Topics collector.
 *
 * Fetches repos by topic from the GitHub Search API.
 * Useful for tracking specific domains (AI, ML, LLM, EdTech, etc.)
 * that may not appear on the trending page.
 *
 * API: GET https://api.github.com/search/repositories?q=topic:{topic}&sort={sort}
 *   sort: stars (default), updated, best-match
 *   order: desc (default), asc
 *
 * GH #24: a topic datasource keeps the **top N** repos of a topic (default 50)
 * in `~/.innate/github-topics/topics/{topic}.json`. Repos that already exist
 * (trending/starred feeds) or that were seen in an earlier snapshot of the same
 * topic are flagged as "known" instead of being re-reported as discoveries —
 * but they stay in the snapshot so that opening a topic shows the full list.
 *
 * Run:
 *   bunx tsx src/collector/github-topics.ts                                 # default topics
 *   bunx tsx src/collector/github-topics.ts --topic edtech
 *   bunx tsx src/collector/github-topics.ts --topic llm --topic agent --sort stars
 *   bunx tsx src/collector/github-topics.ts --limit 50 --save
 *   bunx tsx src/collector/github-topics.ts --list                          # list known topics
 */

import { execFileSync } from "child_process";
import { saveItems } from "./shared/storage.js";
import {
  readTopicSnapshot,
  saveTopicSnapshot,
  type TopicSnapshotItem,
} from "../data/topics-store.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

export type TopicSort = "stars" | "updated" | "best-match";

/** GH #24: "only get top 50" per topic. */
export const TOPIC_LIMIT = 50;

/** GitHub Search API caps `per_page` at 100. */
const MAX_PER_PAGE = 100;

interface GitHubSearchRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  topics: string[];
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  created_at: string;
  updated_at: string;
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchRepo[];
}

/** Curated AI-related topics for quick discovery. */
export const AI_TOPICS = [
  "artificial-intelligence",
  "machine-learning",
  "deep-learning",
  "large-language-model",
  "llm",
  "ai-agent",
  "ai-agents",
  "generative-ai",
  "rag",
  "fine-tuning",
  "transformer",
  "diffusion-model",
  "computer-vision",
  "natural-language-processing",
  "nlp",
  "mlops",
  "vector-database",
  "prompt-engineering",
  "ai-coding",
  "ai-assistant",
];

/** Education / EdTech topics (GH #24). */
export const EDTECH_TOPICS = ["edtech"];

/** Topics synced when no explicit `--topic` is given. */
export const DEFAULT_TOPICS = [...AI_TOPICS, ...EDTECH_TOPICS];

/** GitHub Topics: https://github.com/topics */
export const TOPIC_CATEGORIES: Record<string, string[]> = {
  "AI 核心": [
    "artificial-intelligence",
    "machine-learning",
    "deep-learning",
    "generative-ai",
    "neural-network",
  ],
  "LLM & Agents": [
    "llm",
    "large-language-model",
    "ai-agent",
    "ai-agents",
    "rag",
    "fine-tuning",
    "prompt-engineering",
    "langchain",
    "autogen",
  ],
  "模型 & 训练": [
    "transformer",
    "diffusion-model",
    "gpt",
    "llama",
    "stable-diffusion",
    "mlops",
    "model-training",
  ],
  应用: [
    "ai-coding",
    "ai-assistant",
    "chatbot",
    "ai-search",
    "text-to-image",
    "text-to-speech",
    "voice-assistant",
    "ai-video",
  ],
  基础设施: [
    "vector-database",
    "embedding",
    "gpu",
    "inference",
    "model-serving",
    "edge-ai",
  ],
  多模态: [
    "computer-vision",
    "natural-language-processing",
    "nlp",
    "speech-recognition",
    "image-recognition",
    "object-detection",
    "multimodal",
  ],
  EdTech: ["edtech"],
};

function ghApiSearch(apiPath: string): GitHubSearchResponse {
  const raw = execFileSync("gh", ["api", apiPath, "--jq", "."], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

async function fetchSearchViaHttp(
  query: string,
  sort: TopicSort,
  perPage: number,
  page = 1,
): Promise<GitHubSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    sort,
    per_page: String(perPage),
    page: String(page),
  });
  const res = await fetch(
    `https://api.github.com/search/repositories?${params}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "innate-feeds/0.1",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!res.ok) {
    throw new Error(`GitHub Search API HTTP ${res.status}`);
  }
  return res.json();
}

export interface GitHubTopicsCollectorOptions {
  topics?: string[];
  sort?: TopicSort;
  /** Deprecated alias of `limit`; kept for backwards compatibility. */
  perPage?: number;
  /** Max repos per topic (GH #24: default 50). */
  limit?: number;
}

export class GitHubTopicsCollector implements FeedCollector {
  source = "yc" as const; // reuse "yc" source bucket; not ideal but keeps storage simple

  private topics: string[];
  private sort: TopicSort;
  private perPage: number;
  private limit: number;

  constructor(options?: GitHubTopicsCollectorOptions) {
    this.topics = options?.topics || DEFAULT_TOPICS;
    this.sort = options?.sort || "stars";
    this.limit = Math.max(1, options?.limit ?? TOPIC_LIMIT);
    this.perPage = Math.min(
      Math.max(1, options?.perPage ?? this.limit),
      MAX_PER_PAGE,
    );
  }

  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const allItems: ExternalFeedItem[] = [];

    for (const topic of this.topics) {
      const items = await this.fetchTopic(topic);
      allItems.push(...items);
    }

    // Dedupe by GitHub repo full_name
    const deduped = [...new Map(allItems.map((i) => [i.url, i])).values()];
    console.error(
      `[github-topics] Fetched ${deduped.length} unique repos across ${this.topics.length} topics`,
    );
    return deduped;
  }

  /** Fetch up to `limit` repos of one topic (paged, GitHub caps per_page at 100). */
  async fetchTopic(topic: string): Promise<ExternalFeedItem[]> {
    const query = `topic:${topic}`;
    const perPage = Math.min(this.perPage, this.limit, MAX_PER_PAGE);
    const pages = Math.ceil(this.limit / perPage);

    console.error(
      `[github-topics] Searching: ${query} sort=${this.sort} limit=${this.limit}`,
    );

    const items: ExternalFeedItem[] = [];
    for (let page = 1; page <= pages; page++) {
      const apiPath = `search/repositories?q=${query}&sort=${this.sort}&per_page=${perPage}&page=${page}`;

      let data: GitHubSearchResponse;
      try {
        data = ghApiSearch(apiPath);
      } catch {
        data = await fetchSearchViaHttp(query, this.sort, perPage, page);
      }

      if (data.items.length === 0) break;
      items.push(...data.items.map((repo) => this.normalize(repo, topic)));
      if (data.items.length < perPage) break;
    }

    return items.slice(0, this.limit);
  }

  async save(): Promise<SaveResult> {
    const items = await this.fetchLatest();
    const today = new Date().toISOString().split("T")[0];
    const label = `topics-${today}`;
    return saveItems("github-topics", items, label);
  }

  async saveTopic(topic: string): Promise<SaveResult> {
    const items = await this.fetchTopic(topic);
    return saveItems("github-topics", items, `topic-${topic}`);
  }

  private normalize(repo: GitHubSearchRepo, topic: string): ExternalFeedItem {
    const [owner, name] = repo.full_name.split("/");
    return {
      id: `gh-topic-${repo.id}`,
      source: "github-topics",
      title: name,
      tagline: repo.description || "",
      description: "",
      url: repo.html_url,
      externalUrl: repo.homepage || null,
      imageUrl: repo.owner.avatar_url || null,
      categories: repo.topics || [],
      metrics: {
        stars: repo.stargazers_count,
      },
      metadata: {
        githubRepoId: repo.id,
        fullName: repo.full_name,
        owner,
        ownerLogin: repo.owner.login,
        ownerAvatarUrl: repo.owner.avatar_url,
        ownerUrl: repo.owner.html_url,
        language: repo.language,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        searchedTopic: topic,
        topics: repo.topics,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
      },
      fetchedAt: new Date().toISOString(),
      publishedAt: null,
    };
  }
}

export interface TopicSyncOptions {
  /** Topics to sync; defaults to DEFAULT_TOPICS. */
  topics?: string[];
  /** Max repos per topic (default 50). */
  limit?: number;
  /** Page size of the GitHub Search API (max 100). */
  perPage?: number;
  sort?: TopicSort;
  /**
   * Full names already present in the trending/starred feeds. Those repos are
   * "existing" — they are not reported as new discoveries (but they stay in
   * the snapshot so the topic view can still show them).
   */
  existingFullNames?: Iterable<string>;
  /** Test seam: override how a topic is fetched. */
  fetchTopic?: (topic: string) => Promise<ExternalFeedItem[]>;
}

export interface TopicSyncResult {
  topic: string;
  /** Repos in the snapshot. */
  count: number;
  /** New discoveries: neither in the feeds nor seen before in this topic. */
  newCount: number;
  /** Repos skipped because they already exist in the feeds. */
  skippedExisting: number;
  /** Repos skipped because they were already seen in this topic. */
  skippedSeen: number;
  fetchedAt: string;
  /** Fetched repos (deduped across topics). */
  items: ExternalFeedItem[];
}

/**
 * Sync topics into the topic store (GH #24).
 *
 * Skips (does not re-report as new) repos that
 *  - already exist in the trending/starred feeds, or
 *  - were already seen in an earlier snapshot of the same topic.
 *
 * Skipped repos are still stored, so opening a topic shows the full list.
 */
export async function syncTopics(
  options: TopicSyncOptions = {},
): Promise<TopicSyncResult[]> {
  const topics = options.topics?.length ? options.topics : DEFAULT_TOPICS;
  const limit = Math.max(1, options.limit ?? TOPIC_LIMIT);
  const existing = new Set(
    [...(options.existingFullNames ?? [])].map((name) => name.toLowerCase()),
  );

  const collector = new GitHubTopicsCollector({
    topics,
    sort: options.sort,
    perPage: options.perPage,
    limit,
  });

  const results: TopicSyncResult[] = [];
  for (const topic of topics) {
    const items = options.fetchTopic
      ? await options.fetchTopic(topic)
      : await collector.fetchTopic(topic);
    const previous = readTopicSnapshot(topic);
    const previousFirstSeen = new Map(
      (previous?.items ?? []).map((item) => [item.id, item.firstSeenAt]),
    );

    const fetchedAt = new Date().toISOString();
    let newCount = 0;
    let skippedExisting = 0;
    let skippedSeen = 0;

    const snapshotItems: TopicSnapshotItem[] = items.map((item) => {
      const fullName = String(
        (item.metadata as Record<string, unknown>).fullName ?? "",
      ).toLowerCase();
      const seenBefore = previousFirstSeen.has(item.id);
      const firstSeenAt = seenBefore
        ? (previousFirstSeen.get(item.id) as string)
        : fetchedAt;
      const isExisting = existing.has(fullName);

      if (isExisting) skippedExisting++;
      if (seenBefore) skippedSeen++;
      if (!seenBefore && !isExisting) newCount++;

      return {
        ...item,
        firstSeenAt,
        metadata: {
          ...item.metadata,
          existingInFeeds: isExisting,
        },
      };
    });

    saveTopicSnapshot(topic, snapshotItems, fetchedAt, newCount);

    results.push({
      topic,
      count: snapshotItems.length,
      newCount,
      skippedExisting,
      skippedSeen,
      fetchedAt,
      items,
    });
  }

  return results;
}

export function listTopics(): void {
  console.log("\nKnown GitHub Topics for AI discovery:\n");
  for (const [category, topics] of Object.entries(TOPIC_CATEGORIES)) {
    console.log(`  ${category}:`);
    for (const t of topics) {
      console.log(`    https://github.com/topics/${t}`);
    }
    console.log();
  }
  console.log("Browse all: https://github.com/topics\n");
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /github-topics\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const args = process.argv.slice(2);
  const topics: string[] = [];
  let sort: TopicSort = "stars";
  let perPage = 30;
  let limit = TOPIC_LIMIT;
  let save = false;
  let list = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--topic" && args[i + 1]) topics.push(args[++i]);
    if (args[i] === "--sort" && args[i + 1]) sort = args[++i] as TopicSort;
    if (args[i] === "--per-page" && args[i + 1]) perPage = Number(args[++i]);
    if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    if (args[i] === "--save") save = true;
    if (args[i] === "--list") list = true;
  }

  if (list) {
    listTopics();
    process.exit(0);
  }

  const collector = new GitHubTopicsCollector({
    topics: topics.length ? topics : undefined,
    sort,
    perPage,
    limit,
  });

  if (save) {
    collector
      .save()
      .then((r) =>
        console.log(`Saved ${r.count} repos → ${r.outDir} (${r.bytes} bytes)`),
      )
      .catch(console.error);
  } else {
    collector
      .fetchLatest()
      .then((items) => console.log(JSON.stringify(items, null, 2)))
      .catch(console.error);
  }
}
