/**
 * Fast-growing NEW GitHub repos collector (GH #31).
 *
 * Searches repos created in the last N days (default 7) with a minimum star
 * count, sorted by stars — complements GitHub Trending (which favours
 * established repos) with a "what just took off" view.
 *
 *   - latest: repos created in the last {days} days, top by stars
 *   - byDate: repos created in the {days} days before a date
 *
 * Run:
 *   bun src/collector/github-new.ts                       # print, last 7 days
 *   bun src/collector/github-new.ts --save
 *   bun src/collector/github-new.ts --days 30 --min-stars 20 --save
 */

import { execFileSync } from "child_process";
import { saveItems } from "./shared/storage.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

interface GHSearchRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number | null;
  forks_count: number | null;
  language: string | null;
  created_at: string | null;
  updated_at: string | null;
  topics?: string[];
  owner?: { login?: string; avatar_url?: string };
}

interface GHSearchResponse {
  total_count?: number;
  items?: GHSearchRepo[];
}

function dateDaysAgoIso(days: number, from?: string): string {
  const base = from ? new Date(`${from}T00:00:00Z`) : new Date();
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString().split("T")[0];
}

function ghApiSearch(apiPath: string): GHSearchResponse {
  const raw = execFileSync("gh", ["api", apiPath, "--jq", "."], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

async function fetchSearchViaHttp(
  query: string,
  perPage: number,
): Promise<GHSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(perPage),
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
  if (!res.ok) throw new Error(`GitHub Search API HTTP ${res.status}`);
  return res.json();
}

export function normalizeNewRepo(
  repo: GHSearchRepo,
  label: string,
): ExternalFeedItem {
  return {
    id: `github-new-${repo.id}`,
    source: "github-new",
    title: repo.full_name,
    tagline: repo.description || "",
    description: repo.description || "",
    url: repo.html_url || `https://github.com/${repo.full_name}`,
    externalUrl: repo.html_url || null,
    imageUrl: repo.owner?.avatar_url || null,
    categories: [
      ...(repo.language ? [repo.language] : []),
      ...(repo.topics ?? []),
    ],
    metrics: {
      stars: repo.stargazers_count ?? undefined,
      forks: repo.forks_count ?? undefined,
    },
    metadata: {
      fullName: repo.full_name,
      language: repo.language,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      label,
    },
    fetchedAt: new Date().toISOString(),
    publishedAt: repo.created_at || null,
  };
}

export interface GitHubNewCollectorOptions {
  /** Look-back window in days (default 7). */
  days?: number;
  /** Minimum stars to filter noise (default 10). */
  minStars?: number;
  /** Max repos (default 50). */
  limit?: number;
}

export class GitHubNewCollector implements FeedCollector {
  source = "github-new" as const;
  private days: number;
  private minStars: number;
  private limit: number;

  constructor(options?: GitHubNewCollectorOptions) {
    this.days = options?.days ?? 7;
    this.minStars = options?.minStars ?? 10;
    this.limit = options?.limit ?? 50;
  }

  /** Top new repos created in the window ending today (or `until`). */
  async fetchLatest(until?: string): Promise<ExternalFeedItem[]> {
    const since = dateDaysAgoIso(this.days, until);
    const label = `new-${since}`;
    const query = `stars:>${this.minStars} created:>${since}`;
    console.error(`[github-new] Searching "${query}"`);

    let data: GHSearchResponse;
    try {
      data = ghApiSearch(
        `search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${this.limit}`,
      );
    } catch (err) {
      console.warn(
        "[github-new] gh api failed, falling back to public HTTP:",
        err instanceof Error ? err.message : err,
      );
      data = await fetchSearchViaHttp(query, this.limit);
    }

    return (data.items ?? []).map((repo) => normalizeNewRepo(repo, label));
  }

  /** Save a snapshot labeled by the window start date. */
  async save(until?: string): Promise<SaveResult> {
    const since = dateDaysAgoIso(this.days, until);
    const label = `new-${since}`;
    const items = await this.fetchLatest(until);
    return saveItems("github-new", items, label, `${label}.json`);
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /github-new\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const args = process.argv.slice(2);
  let days = 7;
  let minStars = 10;
  let save = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) days = parseInt(args[++i], 10);
    if (args[i] === "--min-stars" && args[i + 1])
      minStars = parseInt(args[++i], 10);
    if (args[i] === "--save") save = true;
  }

  const collector = new GitHubNewCollector({ days, minStars });
  const run = save
    ? collector
        .save()
        .then((r) =>
          console.log(
            `Saved ${r.count} items → ${r.outDir} (${r.bytes} bytes)`,
          ),
        )
    : collector
        .fetchLatest()
        .then((items) => console.log(JSON.stringify(items, null, 2)));
  run.catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
