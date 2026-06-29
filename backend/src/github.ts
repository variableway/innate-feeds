import { execSync } from "child_process";

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

/**
 * Fetch trending repos from GitHub Trending page
 * Scrapes https://github.com/trending to get actual trending data
 */
export function fetchTrendingRepos(
  period: TrendingPeriod = "daily",
  language?: string,
): GitHubRepo[] {
  let url = "https://github.com/trending";
  if (language) url += `/${language}`;
  if (period !== "daily") url += `?since=${period}`;

  console.log(`Fetching ${period} trending from ${url}...`);

  try {
    // Use gh api to fetch the trending page HTML
    const html = execSync(`gh api -H "Accept: text/html" "${url}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 5 * 1024 * 1024,
    });

    // Parse the HTML to extract repo names
    // GitHub trending page has article elements with repo links
    const repoRegex = /<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"]+)"[^>]*>/g;
    const repos: string[] = [];
    let match;

    while ((match = repoRegex.exec(html)) !== null) {
      const repoPath = match[1];
      // Filter out non-repo links (like /login, /features, etc.)
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

    // Fetch full repo data for each trending repo
    const fullRepos: GitHubRepo[] = [];
    for (const repoFullName of repos.slice(0, 25)) {
      // Limit to 25
      try {
        const repoData = execSync(`gh api "repos/${repoFullName}"`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
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

/**
 * Fetch starred repos for authenticated user
 */
export function fetchStarredRepos(
  username?: string,
  maxPages = 50,
): GitHubRepo[] {
  const endpoint = username ? `users/${username}/starred` : "user/starred";
  const allRepos: GitHubRepo[] = [];

  for (let page = 1; page <= maxPages; page++) {
    console.log(`Fetching starred page ${page}...`);
    try {
      const result = execSync(
        `gh api "${endpoint}?per_page=100&page=${page}"`,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      const data = JSON.parse(result);

      if (!Array.isArray(data) || data.length === 0) break;

      allRepos.push(...data);
      console.log(`  Got ${data.length} repos (total: ${allRepos.length})`);

      if (data.length < 100) break;
    } catch (err) {
      console.error(`Error fetching starred page ${page}:`, err);
      break;
    }
  }

  return allRepos;
}

export interface FetchStarredOptions {
  username?: string;
  maxPages?: number;
  sort?: "created" | "updated";
  direction?: "asc" | "desc";
  stopAt?: string | null;
}

/**
 * Fetch starred repos with star count and date.
 *
 * When stopAt is provided, repos are fetched sorted by starred date descending
 * and fetching stops as soon as a repo with starred_at <= stopAt is seen,
 * making repeated syncs incremental.
 */
export function fetchStarredReposWithDate(
  options: FetchStarredOptions = {},
): { repo: GitHubRepo; starred_at: string }[] {
  const {
    username,
    maxPages = 50,
    sort = "created",
    direction = "desc",
    stopAt = null,
  } = options;

  const endpoint = username ? `users/${username}/starred` : "user/starred";
  const allItems: { repo: GitHubRepo; starred_at: string }[] = [];

  for (let page = 1; page <= maxPages; page++) {
    console.log(`Fetching starred page ${page} with dates...`);

    try {
      const result = execSync(
        `gh api "${endpoint}?per_page=100&page=${page}&sort=${sort}&direction=${direction}" --header "Accept: application/vnd.github.v3.star+json"`,
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
