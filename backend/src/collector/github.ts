import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { ghProcessEnv, readStoredPat } from "../auth/token-store.js";
import {
  getReadmeCachePath,
  readCachedReadme,
  tryWriteCachedReadme,
} from "../data/readme-cache.js";

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
const TRENDING_FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "innate-feeds/0.1 (+https://github.com/variableway/innate-feeds)",
};

function validateUsername(username: string | undefined): string | undefined {
  if (!username) return undefined;
  if (!GITHUB_USERNAME_RE.test(username)) {
    throw new Error(`Invalid GitHub username: ${username}`);
  }
  return username;
}

function trendingUrl(period: TrendingPeriod, language?: string): string {
  let url = "https://github.com/trending";
  if (language) url += `/${language}`;
  if (period !== "daily") url += `?since=${period}`;
  return url;
}

async function fetchTrendingHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: TRENDING_FETCH_HEADERS });
    if (res.ok) {
      return await res.text();
    }
    console.warn(
      `Direct trending fetch returned HTTP ${res.status}, falling back to gh api`,
    );
  } catch (err) {
    console.warn("Direct trending fetch failed, falling back to gh api:", err);
  }

  return execFileSync("gh", ["api", "-H", "Accept: text/html", url], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 5 * 1024 * 1024,
  });
}

/** Extract owner/repo paths from GitHub Trending HTML. */
export function parseTrendingRepoPaths(html: string): string[] {
  const repos: string[] = [];
  const seen = new Set<string>();

  const articles = html.match(/<article class="Box-row">[\s\S]*?<\/article>/g) ?? [];
  for (const article of articles) {
    const h2Match = article.match(
      /<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"]+)"[^>]*>/,
    );
    const repoPath = h2Match?.[1];
    if (!repoPath || !isTrendingRepoPath(repoPath) || seen.has(repoPath)) {
      continue;
    }
    seen.add(repoPath);
    repos.push(repoPath);
  }

  if (repos.length > 0) {
    return repos;
  }

  // Legacy fallback if article markup changes.
  const repoRegex = /<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"]+)"[^>]*>/g;
  let match;
  while ((match = repoRegex.exec(html)) !== null) {
    const repoPath = match[1];
    if (!repoPath || !isTrendingRepoPath(repoPath) || seen.has(repoPath)) {
      continue;
    }
    seen.add(repoPath);
    repos.push(repoPath);
  }

  return repos;
}

function isTrendingRepoPath(repoPath: string): boolean {
  const parts = repoPath.split("/");
  if (parts.length !== 2) return false;
  const [owner, name] = parts;
  if (!owner || !name) return false;
  if (
    owner === "features" ||
    owner === "login" ||
    owner === "sponsors" ||
    owner === "settings" ||
    owner === "orgs"
  ) {
    return false;
  }
  return true;
}

function fetchRepoViaGh(repoFullName: string): GitHubRepo | null {
  try {
    const repoData = execFileSync("gh", ["api", `repos/${repoFullName}`], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(repoData) as GitHubRepo;
  } catch (err) {
    console.error(`Failed to fetch repo via gh ${repoFullName}:`, err);
    return null;
  }
}

async function fetchRepoViaPublicApi(
  repoFullName: string,
): Promise<GitHubRepo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": TRENDING_FETCH_HEADERS["User-Agent"],
      },
    });
    if (!res.ok) {
      console.error(
        `Failed to fetch repo via API ${repoFullName}: HTTP ${res.status}`,
      );
      return null;
    }
    return (await res.json()) as GitHubRepo;
  } catch (err) {
    console.error(`Failed to fetch repo via API ${repoFullName}:`, err);
    return null;
  }
}

function stubRepoFromFullName(repoFullName: string): GitHubRepo {
  const [owner, name] = repoFullName.split("/");
  const now = new Date().toISOString();
  return {
    id: hashRepoId(repoFullName),
    name: name || repoFullName,
    full_name: repoFullName,
    description: null,
    html_url: `https://github.com/${repoFullName}`,
    homepage: null,
    stargazers_count: 0,
    forks_count: 0,
    watchers_count: 0,
    language: null,
    topics: [],
    owner: {
      login: owner || "unknown",
      avatar_url: `https://github.com/${owner || "unknown"}.png`,
      html_url: `https://github.com/${owner || "unknown"}`,
    },
    created_at: now,
    updated_at: now,
  };
}

function hashRepoId(fullName: string): number {
  const hash = createHash("sha256").update(fullName).digest();
  // Match firecrawl.ts: first 6 bytes as a positive integer for SQLite INTEGER.
  return hash.readUIntBE(0, 6);
}

export async function fetchTrendingRepos(
  period: TrendingPeriod = "daily",
  language?: string,
): Promise<GitHubRepo[]> {
  const url = trendingUrl(period, language);
  console.log(`Fetching ${period} trending from ${url}...`);

  try {
    const html = await fetchTrendingHtml(url);
    const repos = parseTrendingRepoPaths(html);
    console.log(`Found ${repos.length} trending repos`);

    const fullRepos: GitHubRepo[] = [];
    for (const repoFullName of repos.slice(0, 25)) {
      const viaGh = fetchRepoViaGh(repoFullName);
      if (viaGh) {
        fullRepos.push(viaGh);
        continue;
      }

      const viaApi = await fetchRepoViaPublicApi(repoFullName);
      if (viaApi) {
        fullRepos.push(viaApi);
        continue;
      }

      console.warn(`Using stub metadata for ${repoFullName}`);
      fullRepos.push(stubRepoFromFullName(repoFullName));
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

const REPO_NAME_RE = /^[\w.-]+$/;
const README_BRANCHES = ["HEAD", "master", "main", "develop"] as const;
const README_FILENAMES = [
  "README.md",
  "Readme.md",
  "readme.md",
  "README.markdown",
  "README.rst",
  "README",
] as const;

export interface RepoReadmeDTO {
  fullName: string;
  name: string;
  markdown: string;
  htmlUrl: string;
  encoding: string;
}

interface GhReadmeResponse {
  name?: string;
  encoding?: string;
  content?: string;
  html_url?: string;
  download_url?: string | null;
  path?: string;
}

function validateRepoParts(owner: string, repo: string): void {
  if (!REPO_NAME_RE.test(owner) || !REPO_NAME_RE.test(repo)) {
    throw new Error(`Invalid owner/repo: ${owner}/${repo}`);
  }
}

function decodeReadmeContent(payload: GhReadmeResponse): string {
  if (payload.encoding === "base64" && payload.content) {
    return Buffer.from(payload.content.replace(/\s/g, ""), "base64").toString(
      "utf-8",
    );
  }
  if (typeof payload.content === "string") {
    return payload.content;
  }
  throw new Error("README response missing content");
}

/** Prefer env tokens, then optional encrypted store (never log the value). */
function resolveGithubToken(): string | undefined {
  const fromEnv =
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    return readStoredPat()?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function githubApiHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": TRENDING_FETCH_HEADERS["User-Agent"],
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchReadmeViaRestApi(
  fullName: string,
  token?: string,
): Promise<GhReadmeResponse | null> {
  const res = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
    headers: githubApiHeaders(token),
    redirect: "follow",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub API README HTTP ${res.status}`);
  }
  return (await res.json()) as GhReadmeResponse;
}

/**
 * Public raw content — often works when api.github.com is blocked by a local
 * HTTP(S)_PROXY (Cursor agent proxy returns CONNECT 403) or when unauth API
 * is rate-limited / gh keyring is invalid.
 */
async function fetchReadmeViaRaw(
  owner: string,
  repo: string,
): Promise<RepoReadmeDTO | null> {
  const fullName = `${owner}/${repo}`;
  const candidates: Array<{ branch: string; name: string }> = [];
  // Prefer common README.md on each ref, then alternate filenames.
  for (const branch of README_BRANCHES) {
    candidates.push({ branch, name: "README.md" });
  }
  for (const branch of README_BRANCHES) {
    for (const name of README_FILENAMES) {
      if (name === "README.md") continue;
      candidates.push({ branch, name });
    }
  }

  for (const { branch, name } of candidates) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${name}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": TRENDING_FETCH_HEADERS["User-Agent"] },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const markdown = await res.text();
      if (!markdown.trim()) continue;
      const blobRef = branch === "HEAD" ? "master" : branch;
      return {
        fullName,
        name,
        markdown,
        htmlUrl: `https://github.com/${fullName}/blob/${blobRef}/${name}`,
        encoding: "utf-8",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[readme] raw fetch failed ${url}: ${msg.split("\n")[0]}`);
    }
  }
  return null;
}

function fetchReadmeViaGhCli(fullName: string): GhReadmeResponse | null {
  try {
    const raw = execFileSync("gh", ["api", `repos/${fullName}/readme`], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 5 * 1024 * 1024,
      env: ghProcessEnv(process.env),
    });
    return JSON.parse(raw) as GhReadmeResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[readme] gh api failed for ${fullName} (${msg.split("\n")[0]})`,
    );
    return null;
  }
}

/**
 * Remote fetch only (no disk). Prefer public REST / raw — do not depend on gh auth.
 * Order: raw.githubusercontent.com → REST API (optional token) → gh api (last resort).
 */
export async function fetchRepoReadmeRemote(
  owner: string,
  repo: string,
): Promise<RepoReadmeDTO> {
  validateRepoParts(owner, repo);
  const fullName = `${owner}/${repo}`;
  const token = resolveGithubToken();
  const errors: string[] = [];

  // Prefer raw first: works when api.github.com is blocked by local HTTP(S)_PROXY
  // (Cursor agent CONNECT 403) and when unauthenticated API is rate-limited.
  const fromRaw = await fetchReadmeViaRaw(owner, repo);
  if (fromRaw) return fromRaw;
  errors.push("raw.githubusercontent.com: not found");

  try {
    const payload = await fetchReadmeViaRestApi(fullName, token);
    if (payload) {
      const markdown = decodeReadmeContent(payload);
      return {
        fullName,
        name: payload.name || payload.path || "README.md",
        markdown,
        htmlUrl: payload.html_url || `https://github.com/${fullName}`,
        encoding: payload.encoding || "utf-8",
      };
    }
    errors.push("REST API: 404");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`REST API: ${msg.split("\n")[0]}`);
    console.warn(`[readme] REST API failed for ${fullName}: ${msg.split("\n")[0]}`);
  }

  const fromGh = fetchReadmeViaGhCli(fullName);
  if (fromGh) {
    try {
      const markdown = decodeReadmeContent(fromGh);
      return {
        fullName,
        name: fromGh.name || fromGh.path || "README.md",
        markdown,
        htmlUrl: fromGh.html_url || `https://github.com/${fullName}`,
        encoding: fromGh.encoding || "utf-8",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`gh decode: ${msg}`);
    }
  } else {
    errors.push("gh api: failed");
  }

  const notFound = errors.every((e) => /404|not found/i.test(e));
  throw Object.assign(
    new Error(
      notFound
        ? `README not found for ${fullName}`
        : `Failed to fetch README for ${fullName} (${errors.join("; ")})`,
    ),
    { status: notFound ? 404 : 502 },
  );
}

const refreshInFlight = new Set<string>();

function scheduleReadmeRefresh(owner: string, repo: string): void {
  const key = `${owner}/${repo}`;
  if (refreshInFlight.has(key)) return;
  refreshInFlight.add(key);
  void fetchRepoReadmeRemote(owner, repo)
    .then((fresh) => {
      const path = tryWriteCachedReadme(owner, repo, fresh);
      if (path) console.log(`[readme] background refresh wrote ${path}`);
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[readme] background refresh failed ${key}: ${msg.split("\n")[0]}`);
    })
    .finally(() => {
      refreshInFlight.delete(key);
    });
}

/**
 * On-demand README for repo detail: disk cache first, then public/raw remote.
 * Successful remote fetches are persisted under project `readmes/{owner}/{repo}.md`
 * (path configurable via Settings / innate-feeds.config.json / READMES_DIR).
 */
export async function fetchRepoReadme(
  owner: string,
  repo: string,
): Promise<RepoReadmeDTO> {
  validateRepoParts(owner, repo);

  const cached = readCachedReadme(owner, repo);
  if (cached) {
    scheduleReadmeRefresh(owner, repo);
    return cached;
  }

  const remote = await fetchRepoReadmeRemote(owner, repo);
  const path = tryWriteCachedReadme(owner, repo, remote);
  if (path) {
    console.log(`[readme] cached ${owner}/${repo} → ${path}`);
  }
  return remote;
}

export { getReadmeCachePath };
