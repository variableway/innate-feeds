import type {
  DigestFeedItem,
  DigestFilters,
  DigestResponse,
  DigestSourceId,
  RepoReadme,
} from "@/types/feed";

const GH_API = "https://api.github.com";
const DIGEST_CACHE_KEY = "innate-feeds:digest-live:v1";
const DIGEST_CACHE_TTL_MS = 15 * 60 * 1000;
const README_CACHE_TTL_MS = 30 * 60 * 1000;

export const DIGEST_SOURCES: {
  id: DigestSourceId;
  repo: string;
}[] = [
  { id: "ruanyf-weekly", repo: "ruanyf/weekly" },
  { id: "github-daily", repo: "GitHubDaily/GitHubDaily" },
];

const CATEGORY_RE = /^[\[【]([^\]】]+)[\]】]/;
const URL_RE = /https?:\/\/[^\s)\]>"'<]+/g;
const GH_REPO_RE =
  /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[\/?#]|$)/i;

interface GhIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  comments: number;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string } | null;
  labels: { name: string }[] | string[];
  pull_request?: unknown;
}

interface DigestCachePayload {
  fetchedAt: string;
  items: DigestFeedItem[];
}

const readmeMemory = new Map<
  string,
  { at: number; value: RepoReadme }
>();
let digestMemory: DigestCachePayload | null = null;

function ghHeaders(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghGetJson(path: string): Promise<unknown> {
  const res = await fetch(`${GH_API}/${path.replace(/^\//, "")}`, {
    headers: ghHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub API ${res.status} (${path}): ${body.slice(0, 160) || res.statusText}`,
    );
  }
  return res.json();
}

function parseCategory(title: string): string | null {
  const m = title.match(CATEGORY_RE);
  return m ? m[1].trim() : null;
}

function stripTrailingPunct(url: string): string {
  return url.replace(/[.,;:）)】»"']+$/g, "").replace(/&amp;/g, "&");
}

function extractUrls(body: string | null): string[] {
  if (!body) return [];
  const found = body.match(URL_RE) ?? [];
  return [...new Set(found.map(stripTrailingPunct))];
}

function isAttachmentOrMeta(url: string): boolean {
  return (
    /github\.com\/user-attachments\//i.test(url) ||
    /camo\.githubusercontent\.com/i.test(url) ||
    /avatars\.githubusercontent\.com/i.test(url)
  );
}

function parseGithubRepoFullName(url: string): string | null {
  const m = url.match(GH_REPO_RE);
  if (!m) return null;
  const full = `${m[1]}/${m[2]}`;
  if (/^(issues|pull|discussions|actions|wiki|releases)$/i.test(m[2])) {
    return null;
  }
  return full;
}

function pickPrimaryLink(
  urls: string[],
  sourceRepo: string,
): { primaryUrl: string | null; githubRepoFullName: string | null } {
  const usable = urls.filter((u) => !isAttachmentOrMeta(u));
  let githubRepoFullName: string | null = null;
  let primaryUrl: string | null = null;

  for (const u of usable) {
    const full = parseGithubRepoFullName(u);
    if (full && full.toLowerCase() !== sourceRepo.toLowerCase()) {
      githubRepoFullName = full;
      primaryUrl = `https://github.com/${full}`;
      break;
    }
  }

  if (!primaryUrl && usable.length > 0) {
    primaryUrl = usable[0] ?? null;
  }

  return { primaryUrl, githubRepoFullName };
}

function excerptBody(body: string | null, maxLen = 280): string {
  if (!body) return "";
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`;
}

function labelNames(labels: GhIssue["labels"]): string[] {
  return (labels ?? []).map((l) => (typeof l === "string" ? l : l.name));
}

function toDigestItem(
  source: { id: DigestSourceId; repo: string },
  issue: GhIssue,
  fetchedAt: string,
): DigestFeedItem | null {
  if (issue.pull_request) return null;
  const urls = extractUrls(issue.body);
  const { primaryUrl, githubRepoFullName } = pickPrimaryLink(
    urls,
    source.repo,
  );
  return {
    id: `digest-${source.id}-${issue.id}`,
    type: "digest",
    source: source.id,
    sourceRepo: source.repo,
    title: issue.title,
    category: parseCategory(issue.title),
    excerpt: excerptBody(issue.body),
    bodyMarkdown: issue.body ?? null,
    primaryUrl,
    githubRepoFullName,
    issueUrl: issue.html_url,
    issueNumber: issue.number,
    authorLogin: issue.user?.login ?? "unknown",
    authorAvatarUrl: issue.user?.avatar_url ?? null,
    issueCreatedAt: issue.created_at,
    issueUpdatedAt: issue.updated_at,
    labels: labelNames(issue.labels),
    comments: issue.comments ?? 0,
    state: issue.state,
    fetchedAt,
  };
}

function readSessionCache(): DigestCachePayload | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DIGEST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DigestCachePayload & { cachedAt?: number };
    const cachedAt = Date.parse(parsed.fetchedAt);
    if (
      Number.isNaN(cachedAt) ||
      Date.now() - cachedAt > DIGEST_CACHE_TTL_MS
    ) {
      return null;
    }
    if (!Array.isArray(parsed.items)) return null;
    return { fetchedAt: parsed.fetchedAt, items: parsed.items };
  } catch {
    return null;
  }
}

function compactDigestItems(items: DigestFeedItem[]): DigestFeedItem[] {
  return items.map(({ bodyMarkdown: _body, ...rest }) => rest);
}

function writeSessionCache(payload: DigestCachePayload): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      DIGEST_CACHE_KEY,
      JSON.stringify({
        fetchedAt: payload.fetchedAt,
        items: compactDigestItems(payload.items),
      }),
    );
  } catch {
    // quota — keep memory cache only
  }
}

async function fetchSourceIssues(
  source: { id: DigestSourceId; repo: string },
  fetchedAt: string,
): Promise<DigestFeedItem[]> {
  const items: DigestFeedItem[] = [];
  const perPage = 50;
  const maxPages = 2;
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      state: "all",
      per_page: String(perPage),
      page: String(page),
      sort: "created",
      direction: "desc",
    });
    const raw = await ghGetJson(
      `repos/${source.repo}/issues?${params.toString()}`,
    );
    if (!Array.isArray(raw) || raw.length === 0) break;
    for (const row of raw as GhIssue[]) {
      const item = toDigestItem(source, row, fetchedAt);
      if (item) items.push(item);
    }
    if (raw.length < perPage) break;
  }
  return items;
}

export async function fetchDigestLive(): Promise<DigestCachePayload> {
  if (digestMemory && Date.now() - Date.parse(digestMemory.fetchedAt) < DIGEST_CACHE_TTL_MS) {
    return digestMemory;
  }
  const fromSession = readSessionCache();
  if (fromSession) {
    digestMemory = fromSession;
    return fromSession;
  }

  const fetchedAt = new Date().toISOString();
  const batches = await Promise.all(
    DIGEST_SOURCES.map((source) => fetchSourceIssues(source, fetchedAt)),
  );
  const items = batches.flat();
  items.sort((a, b) =>
    a.issueCreatedAt < b.issueCreatedAt
      ? 1
      : a.issueCreatedAt > b.issueCreatedAt
        ? -1
        : 0,
  );
  const payload = { fetchedAt, items };
  digestMemory = payload;
  writeSessionCache(payload);
  return payload;
}

export function applyDigestFilters(
  all: DigestFeedItem[],
  filters: DigestFilters,
  page: number,
  pageSize: number,
  fetchedAt: string,
): DigestResponse {
  let items = [...all];

  if (filters.source) {
    items = items.filter((i) => i.source === filters.source);
  }
  if (filters.category === "__uncategorized__") {
    items = items.filter((i) => !i.category);
  } else if (filters.category) {
    items = items.filter((i) => i.category === filters.category);
  }
  if (filters.hasPrimaryUrl) {
    items = items.filter((i) => Boolean(i.primaryUrl));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.excerpt.toLowerCase().includes(q) ||
        i.authorLogin.toLowerCase().includes(q) ||
        (i.category?.toLowerCase().includes(q) ?? false),
    );
  }

  const sort = filters.sort || "created";
  const order = filters.order || "desc";
  const mult = order === "asc" ? 1 : -1;
  items.sort((a, b) => {
    let av: string | number = a.issueCreatedAt;
    let bv: string | number = b.issueCreatedAt;
    if (sort === "updated") {
      av = a.issueUpdatedAt;
      bv = b.issueUpdatedAt;
    } else if (sort === "comments") {
      av = a.comments;
      bv = b.comments;
    }
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });

  const categories = [
    ...new Set(all.map((i) => i.category).filter((c): c is string => Boolean(c))),
  ].sort();
  const sources = DIGEST_SOURCES.map((s) => ({
    id: s.id,
    repo: s.repo,
    count: all.filter((i) => i.source === s.id).length,
  }));

  const total = items.length;
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize).map((item) => ({
    ...item,
    bodyMarkdown: undefined,
  }));

  return {
    items: pageItems,
    total,
    page,
    pageSize,
    categories,
    sources,
    fetchedAt,
  };
}

export async function fetchDigestDetailLive(
  id: string,
): Promise<DigestFeedItem> {
  const cached = digestMemory ?? readSessionCache();
  const hit = cached?.items.find((i) => i.id === id);
  if (hit?.bodyMarkdown) return hit;

  if (hit?.issueNumber && hit.sourceRepo) {
    const raw = (await ghGetJson(
      `repos/${hit.sourceRepo}/issues/${hit.issueNumber}`,
    )) as GhIssue;
    const source = DIGEST_SOURCES.find((s) => s.repo === hit.sourceRepo);
    if (!source) throw new Error(`Unknown digest source for ${id}`);
    const item = toDigestItem(
      source,
      raw,
      cached?.fetchedAt || new Date().toISOString(),
    );
    if (!item) throw new Error(`Issue ${id} is not a digest item`);
    return item;
  }

  const fresh = await fetchDigestLive();
  const found = fresh.items.find((i) => i.id === id);
  if (!found) throw new Error(`Digest item not found: ${id}`);
  return found;
}

function decodeGitHubBase64(content: string): string {
  const bin = atob(content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function fetchReadmeRaw(
  owner: string,
  repo: string,
): Promise<string | null> {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/readme.md`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text.trim()) return text;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function fetchRepoReadmeLive(
  fullName: string,
): Promise<RepoReadme> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo full name: ${fullName}`);
  }

  const cached = readmeMemory.get(fullName);
  if (cached && Date.now() - cached.at < README_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const payload = (await ghGetJson(
      `repos/${owner}/${repo}/readme`,
    )) as {
      name?: string;
      content?: string;
      encoding?: string;
      html_url?: string;
    };
    let markdown = "";
    if (payload.encoding === "base64" && payload.content) {
      markdown = decodeGitHubBase64(payload.content);
    } else if (typeof payload.content === "string") {
      markdown = payload.content;
    }
    if (!markdown.trim()) {
      markdown = (await fetchReadmeRaw(owner, repo)) || "";
    }
    const value: RepoReadme = {
      fullName: `${owner}/${repo}`,
      name: payload.name || "README.md",
      markdown,
      htmlUrl: payload.html_url || `https://github.com/${owner}/${repo}`,
      encoding: "utf-8",
    };
    readmeMemory.set(fullName, { at: Date.now(), value });
    return value;
  } catch (apiErr) {
    const raw = await fetchReadmeRaw(owner, repo);
    if (raw) {
      const value: RepoReadme = {
        fullName: `${owner}/${repo}`,
        name: "README.md",
        markdown: raw,
        htmlUrl: `https://github.com/${owner}/${repo}`,
        encoding: "utf-8",
      };
      readmeMemory.set(fullName, { at: Date.now(), value });
      return value;
    }
    throw apiErr;
  }
}
