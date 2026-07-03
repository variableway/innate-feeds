import { execFileSync } from "child_process";

export interface GitHubRepo {
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

export type TrendingPeriod = "daily" | "weekly" | "monthly";

const GITHUB_USERNAME_RE = /^[\w.-]{1,39}$/;

function validateUsername(username: string | undefined): string | undefined {
  if (!username) return undefined;
  if (!GITHUB_USERNAME_RE.test(username)) {
    throw new Error(`Invalid GitHub username: ${username}`);
  }
  return username;
}

export function fetchTrendingRepos(
  period: TrendingPeriod = "daily",
  language?: string,
): GitHubRepo[] {
  let url = "https://github.com/trending";
  if (language) url += `/${language}`;
  if (period !== "daily") url += `?since=${period}`;

  console.log(`Fetching ${period} trending from ${url}...`);

  try {
    const html = execFileSync(
      "gh",
      ["api", "-H", "Accept: text/html", url],
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 5 * 1024 * 1024,
      },
    );

    const repoRegex = /<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"]+)"[^>]*>/g;
    const repos: string[] = [];
    let match;

    while ((match = repoRegex.exec(html)) !== null) {
      const repoPath = match[1];
      if (
        repoPath &&
        repoPath.split("/").length === 2 &&
        !repoPath.startsWith("features") &&
        !repoPath.startsWith("login")
      ) {
        repos.push(repoPath);
      }
    }

    console.log(`Found ${repos.length} trending repos`);

    const fullRepos: GitHubRepo[] = [];
    for (const repoFullName of repos.slice(0, 25)) {
      try {
        const repoData = execFileSync(
          "gh",
          ["api", `repos/${repoFullName}`],
          {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        fullRepos.push(JSON.parse(repoData));
      } catch (err) {
        console.error(`Failed to fetch repo ${repoFullName}:`, err);
      }
    }

    return fullRepos;
  } catch (err) {
    console.error(`Failed to fetch trending:`, err);
    return [];
  }
}

export interface FetchStarredOptions {
  username?: string;
  maxPages?: number;
  sort?: "created" | "updated";
  direction?: "asc" | "desc";
  stopAt?: string | null;
}

export function fetchStarredReposWithDate(
  options: FetchStarredOptions = {},
): { repo: GitHubRepo; starred_at: string }[] {
  const {
    username: rawUsername,
    maxPages = 50,
    sort = "created",
    direction = "desc",
    stopAt = null,
  } = options;

  const username = validateUsername(rawUsername);
  const endpoint = username ? `users/${username}/starred` : "user/starred";
  const allItems: { repo: GitHubRepo; starred_at: string }[] = [];

  for (let page = 1; page <= maxPages; page++) {
    console.log(`Fetching starred page ${page} with dates...`);

    try {
      const result = execFileSync(
        "gh",
        [
          "api",
          `${endpoint}?per_page=100&page=${page}&sort=${sort}&direction=${direction}`,
          "--header",
          "Accept: application/vnd.github.v3.star+json",
        ],
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      const data = JSON.parse(result);

      if (!Array.isArray(data) || data.length === 0) break;

      for (const item of data) {
        if (stopAt && item.starred_at && item.starred_at <= stopAt) {
          console.log(
            `  Stopping at already-synced repo starred at ${item.starred_at}`,
          );
          return allItems;
        }

        allItems.push({
          repo: item.repo,
          starred_at: item.starred_at,
        });
      }

      console.log(`  Got ${data.length} repos (total: ${allItems.length})`);

      if (data.length < 100) break;
    } catch (err) {
      console.error(`Error fetching starred page ${page}:`, err);
      break;
    }
  }

  return allItems;
}
