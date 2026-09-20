/**
 * GitHub Topics collector.
 *
 * Fetches repos by topic from the GitHub Search API.
 * Useful for tracking specific domains (AI, ML, LLM, etc.)
 * that may not appear on the trending page.
 *
 * API: GET https://api.github.com/search/repositories?q=topic:{topic}&sort={sort}
 *   sort: stars (default), updated, best-match
 *   order: desc (default), asc
 *
 * Run:
 *   bunx tsx src/collector/github-topics.ts                                 # default AI topics
 *   bunx tsx src/collector/github-topics.ts --topic artificial-intelligence
 *   bunx tsx src/collector/github-topics.ts --topic llm --topic agent --sort stars
 *   bunx tsx src/collector/github-topics.ts --save
 *   bunx tsx src/collector/github-topics.ts --list                          # list known topics
 */

import { execFileSync } from "child_process";
import { saveItems } from "./shared/storage.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

export type TopicSort = "stars" | "updated" | "best-match";

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
  perPage = 30,
): Promise<GitHubSearchResponse> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "innate-feeds/0.1",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`GitHub Search API HTTP ${res.status}`);
  }
  return res.json();
}

export class GitHubTopicsCollector implements FeedCollector {
  source = "yc" as const; // reuse "yc" source bucket; not ideal but keeps storage simple

  private topics: string[];
  private sort: TopicSort;
  private perPage: number;

  constructor(options?: {
    topics?: string[];
    sort?: TopicSort;
    perPage?: number;
  }) {
    this.topics = options?.topics || AI_TOPICS;
    this.sort = options?.sort || "stars";
    this.perPage = options?.perPage || 30;
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

  async fetchTopic(topic: string): Promise<ExternalFeedItem[]> {
    const sortParam = this.sort === "best-match" ? "best%20match" : this.sort;
    const query = `topic:${topic}`;
    const apiPath = `search/repositories?q=${query}&sort=${sortParam}&per_page=${this.perPage}`;

    console.error(`[github-topics] Searching: ${query} sort=${sortParam}`);

    let data: GitHubSearchResponse;
    try {
      data = ghApiSearch(apiPath);
    } catch {
      data = await fetchSearchViaHttp(
        `search/repositories?q=${query}&sort=${sortParam}`,
        this.perPage,
      );
    }

    return data.items.map((repo) => this.normalize(repo, topic));
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
  let save = false;
  let list = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--topic" && args[i + 1]) topics.push(args[++i]);
    if (args[i] === "--sort" && args[i + 1]) sort = args[++i] as TopicSort;
    if (args[i] === "--per-page" && args[i + 1]) perPage = Number(args[++i]);
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
