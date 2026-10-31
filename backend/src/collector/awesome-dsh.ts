/**
 * Awesome DSH plugin catalog updater (GH #30).
 *
 * The upstream site publishes a compact format-1 market index. That is a much
 * smaller update unit than cloning the whole awesome-list repository. Current
 * star counts are enriched through GitHub GraphQL so Stars sorting reflects
 * data newer than the upstream checkedAt snapshot.
 */
import { execFileSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fetchJson } from "./shared/http.js";
import { getSourceDir } from "./shared/storage.js";
import { readStoredPat } from "../auth/token-store.js";
import { getProjectRoot } from "../data/app-config.js";
import {
  PLUGIN_CATEGORY_IDS,
  pluginCategoryById,
} from "../../../shared/plugin-categories.js";

export const AWESOME_DSH_REPO = "awesome-dsh-plugin/awesome-dsh-plugin";
export const AWESOME_DSH_INDEX_URL =
  "https://awesome-dsh-plugin.com/index.json";

/** Plugin catalog snapshots stay on the machine; they are not repo assets. */
export function getAwesomeDshDir(): string {
  return getSourceDir("awesome-dsh");
}

export function getAwesomeDshCatalogPath(): string {
  return join(getAwesomeDshDir(), "plugin-catalog.json");
}

export interface AwesomeMarketPlugin {
  name?: unknown;
  description?: { en?: unknown; zh?: unknown };
  repository?: { url?: unknown };
  metadata?: { category?: unknown };
  versions?: { version?: unknown; publishTimestamp?: unknown }[];
}

export interface AwesomeMarketIndex {
  format?: unknown;
  plugins?: AwesomeMarketPlugin[];
}

export interface MarketCatalogPlugin {
  slug: string;
  name: string;
  tagline: string;
  taglineZh: string | null;
  description: string;
  content: string;
  stars: number;
  screenshotUrl: string | null;
  screenshots: string[];
  bundleCategory: string;
  bundleCategoryZh: string;
  repositoryUrl: string;
  websiteUrl: string;
  installCommand: string;
  npmPackage: string | null;
  tarballUrl: string | null;
  publishedAt: string | null;
  starsUpdatedAt: string;
}

export interface MarketCatalogFile {
  schemaVersion: 1;
  fetchedAt: string;
  source: {
    repository: string;
    indexUrl: string;
  };
  plugins: MarketCatalogPlugin[];
}

export interface AwesomeDshSyncSummary {
  plugins: number;
  added: number;
  removed: number;
  starChanges: number;
  starsFresh: number;
  bytes: number;
  path: string;
  fetchedAt: string;
  rateLimitRemaining: number | null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseGitHubUrl(url: string): { fullName: string; path: string } {
  const rest = url
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const [owner = "", repo = ""] = rest.split("/");
  return { fullName: `${owner}/${repo}`, path: `${owner}/${repo}` };
}

export function slugFromRepoPath(path: string): string {
  return path
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildContent(plugin: MarketCatalogPlugin): string {
  const lines = ["## Install", "", "```sh", plugin.installCommand, "```", ""];
  if (plugin.npmPackage) {
    lines.push(
      `Also available as npm package [\`${plugin.npmPackage}\`](https://www.npmjs.com/package/${plugin.npmPackage}).`,
      "",
    );
  }
  lines.push(
    `Source: [${plugin.repositoryUrl}](${plugin.repositoryUrl})`,
    "",
    "---",
    "",
    "> Installing a plugin runs third-party code with your own permissions. Review the source before you install.",
  );
  return lines.join("\n");
}

export function normalizeMarketIndex(
  index: AwesomeMarketIndex,
  fetchedAt: string,
  fallbackStars: Record<string, number> = {},
  fallbackScreenshots: Record<string, string[]> = {},
): MarketCatalogPlugin[] {
  const plugins: MarketCatalogPlugin[] = [];
  const usedSlugs = new Set<string>();

  for (const raw of index.plugins ?? []) {
    const repositoryUrl = str(raw.repository?.url).replace(/\/+$/, "");
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/i.test(repositoryUrl)) continue;
    const { fullName, path } = parseGitHubUrl(repositoryUrl);
    if (!/^[\w.-]+\/[\w.-]+$/.test(path)) continue;

    const category = str(raw.metadata?.category);
    if (!PLUGIN_CATEGORY_IDS.includes(category as never)) continue;
    const categoryMeta = pluginCategoryById(category);
    if (!categoryMeta) continue;

    const tagline = str(raw.description?.en).trim();
    if (!tagline) continue;

    const npmPackage = str(raw.name).trim() || null;
    const installCommand = npmPackage
      ? `dsh plugin --profile web add ${npmPackage}`
      : `dsh plugin --profile web add github:${path}`;
    const latest = [...(raw.versions ?? [])]
      .filter(
        (version) =>
          typeof version.publishTimestamp === "number" &&
          Number.isFinite(version.publishTimestamp),
      )
      .sort(
        (a, b) =>
          (b.publishTimestamp as number) - (a.publishTimestamp as number),
      )[0];
    const publishedAt =
      typeof latest?.publishTimestamp === "number"
        ? new Date(latest.publishTimestamp * 1000).toISOString()
        : null;

    const taglineZh = str(raw.description?.zh).trim() || null;
    const screenshots = fallbackScreenshots[repositoryUrl] ?? [];
    const repoSlug = slugFromRepoPath(path);
    let slug = repoSlug;
    if (usedSlugs.has(slug)) {
      slug = slugFromRepoPath(`${path}--${npmPackage ?? "plugin"}`);
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${repoSlug}-${suffix++}`;
      }
    }
    usedSlugs.add(slug);
    const plugin: MarketCatalogPlugin = {
      slug,
      name: fullName,
      tagline,
      taglineZh,
      description: tagline,
      content: "",
      stars: fallbackStars[repositoryUrl] ?? 0,
      screenshotUrl: screenshots[0] ?? null,
      screenshots: screenshots.slice(1),
      bundleCategory: category,
      bundleCategoryZh: categoryMeta.labelZh,
      repositoryUrl,
      websiteUrl: `https://github.com/${path}`,
      installCommand,
      npmPackage,
      tarballUrl: null,
      publishedAt,
      starsUpdatedAt: fetchedAt,
    };
    plugin.content = buildContent(plugin);
    plugins.push(plugin);
  }

  return plugins;
}

function resolveToken(): string | undefined {
  const fromEnv =
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const stored = readStoredPat()?.trim();
    if (stored) return stored;
  } catch {
    // Continue: gh users commonly have an interactive token without an
    // encrypted PAT stored by this app.
  }
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return undefined;
  }
}

async function fetchStarsForBatch(
  repoPaths: string[],
  startIndex: number,
  token: string | undefined,
): Promise<{
  stars: Map<string, number>;
  rateLimitRemaining: number | null;
  resolved: number;
}> {
  const query = `query AwesomeDshStars {
  rateLimit { remaining }
  ${repoPaths
    .map((path, idx) => {
      const [owner = "", name = ""] = path.split("/");
      return `r${startIndex + idx}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { stargazerCount }`;
    })
    .join("\n  ")}
}`;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token ?? ""}`,
      "Content-Type": "application/json",
      "User-Agent": "innate-feeds/0.1",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL HTTP ${res.status}`);

  const payload = (await res.json()) as {
    data?: Record<string, { stargazerCount?: number } | null> & {
      rateLimit?: { remaining?: number };
    };
    errors?: { message?: string }[];
    message?: string;
  };
  if (payload.errors && !payload.data) {
    throw new Error(
      payload.errors[0]?.message ?? payload.message ?? "GitHub GraphQL failed",
    );
  }
  if (payload.errors) {
    // Curated lists can contain recently deleted/private repositories. Keep
    // the successfully resolved aliases and let missing repositories fall back.
    console.warn(
      `[awesome-dsh] ${payload.errors.length} repository lookup(s) skipped: ${payload.errors[0]?.message ?? "GitHub GraphQL error"}`,
    );
  }

  const stars = new Map<string, number>();
  repoPaths.forEach((path, idx) => {
    const repository = payload.data?.[`r${startIndex + idx}`];
    const count = repository?.stargazerCount;
    if (typeof count === "number") {
      stars.set(`https://github.com/${path}`, count);
    }
  });
  const resolved = repoPaths.filter(
    (_, idx) =>
      typeof payload.data?.[`r${startIndex + idx}`]?.stargazerCount ===
      "number",
  ).length;
  return {
    stars,
    rateLimitRemaining: payload.data?.rateLimit?.remaining ?? null,
    resolved,
  };
}

export async function fetchCurrentStars(
  repositoryUrls: string[],
  fallbackStars: Record<string, number>,
): Promise<{
  stars: Record<string, number>;
  fresh: number;
  rateLimitRemaining: number | null;
}> {
  const repoPaths = [
    ...new Set(
      repositoryUrls
        .map((url) => parseGitHubUrl(url).path)
        .filter((path) => /^[\w.-]+\/[\w.-]+$/.test(path)),
    ),
  ];
  const token = resolveToken();
  if (!token || repoPaths.length === 0) {
    return { stars: fallbackStars, fresh: 0, rateLimitRemaining: null };
  }

  const stars: Record<string, number> = { ...fallbackStars };
  let fresh = 0;
  let rateLimitRemaining: number | null = null;
  for (let start = 0; start < repoPaths.length; start += 100) {
    const result = await fetchStarsForBatch(
      repoPaths.slice(start, start + 100),
      start,
      token,
    );
    for (const [url, count] of result.stars) {
      stars[url] = count;
    }
    fresh += result.resolved;
    if (result.rateLimitRemaining != null) {
      rateLimitRemaining = result.rateLimitRemaining;
    }
  }
  return { stars, fresh, rateLimitRemaining };
}

function readFallbackScreenshots(): Record<string, string[]> {
  try {
    return JSON.parse(
      readFileSync(
        join(
          getProjectRoot(),
          "awesome/awesome-dsh-plugin/data/screenshots.json",
        ),
        "utf8",
      ),
    ) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function readExistingCatalogStars(): Record<string, number> {
  try {
    const catalog = JSON.parse(
      readFileSync(getAwesomeDshCatalogPath(), "utf8"),
    ) as MarketCatalogFile | undefined;
    return Object.fromEntries(
      (catalog?.plugins ?? []).map((plugin) => [
        plugin.repositoryUrl,
        plugin.stars,
      ]),
    );
  } catch {
    return {};
  }
}

function compareWithExisting(next: MarketCatalogPlugin[]): {
  added: number;
  removed: number;
  starChanges: number;
} {
  const previous = readExistingCatalogStars();
  const nextByRepo = new Map(
    next.map((plugin) => [plugin.repositoryUrl, plugin]),
  );
  const added = next.filter(
    (plugin) => !(plugin.repositoryUrl in previous),
  ).length;
  const removed = Object.keys(previous).filter(
    (url) => !nextByRepo.has(url),
  ).length;
  const starChanges = next.filter(
    (plugin) =>
      plugin.repositoryUrl in previous &&
      previous[plugin.repositoryUrl] !== plugin.stars,
  ).length;
  return { added, removed, starChanges };
}

export async function syncAwesomeDsh(): Promise<AwesomeDshSyncSummary> {
  const fetchedAt = new Date().toISOString();
  const index = await fetchJson<AwesomeMarketIndex>(AWESOME_DSH_INDEX_URL, {
    timeout: 90_000,
  });
  if (index.format !== 1 || !Array.isArray(index.plugins)) {
    throw new Error("Unexpected awesome-dsh-plugin market index format");
  }

  const fallbackStars = readExistingCatalogStars();
  const normalized = normalizeMarketIndex(
    index,
    fetchedAt,
    fallbackStars,
    readFallbackScreenshots(),
  );
  const currentStars = await fetchCurrentStars(
    normalized.map((plugin) => plugin.repositoryUrl),
    fallbackStars,
  );
  for (const plugin of normalized) {
    plugin.stars = currentStars.stars[plugin.repositoryUrl] ?? plugin.stars;
  }

  const catalog: MarketCatalogFile = {
    schemaVersion: 1,
    fetchedAt,
    source: {
      repository: AWESOME_DSH_REPO,
      indexUrl: AWESOME_DSH_INDEX_URL,
    },
    plugins: normalized,
  };
  const path = getAwesomeDshCatalogPath();
  mkdirSync(getAwesomeDshDir(), { recursive: true });
  // Keep the vendored update unit compact; static export remains derived JSON.
  const json = JSON.stringify(catalog);
  writeFileSync(path, json, "utf8");

  return {
    plugins: normalized.length,
    ...compareWithExisting(normalized),
    starsFresh: currentStars.fresh,
    bytes: Buffer.byteLength(json, "utf8"),
    path,
    fetchedAt,
    rateLimitRemaining: currentStars.rateLimitRemaining,
  };
}
