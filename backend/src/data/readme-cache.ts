import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { resolveReadmesRoot } from "./app-config.js";
import type { RepoReadmeDTO } from "../collector/github.js";

const REPO_NAME_RE = /^[\w.-]+$/;

export interface CachedReadmeMeta {
  fullName: string;
  name: string;
  htmlUrl: string;
  encoding: string;
  fetchedAt: string;
}

/**
 * Filename scheme under the configured readmes root:
 *   `{owner}/{repo}.md`   (+ sibling `{owner}/{repo}.json` meta)
 *
 * Avoids collisions across owners; root via `./readmes`,
 * `innate-feeds.config.json`, or `READMES_DIR`.
 */
function cachePaths(
  owner: string,
  repo: string,
  root = resolveReadmesRoot(),
): { md: string; meta: string } {
  if (!REPO_NAME_RE.test(owner) || !REPO_NAME_RE.test(repo)) {
    throw new Error(`Invalid owner/repo for cache: ${owner}/${repo}`);
  }
  const dir = join(root, owner);
  mkdirSync(dir, { recursive: true });
  return {
    md: join(dir, `${repo}.md`),
    meta: join(dir, `${repo}.json`),
  };
}

/** Skip a batch refresh when the on-disk copy is newer than `maxAgeMs`. */
export function shouldSkipReadmeRefresh(
  fetchedAt: string | null | undefined,
  maxAgeMs: number,
  now = Date.now(),
): boolean {
  if (!fetchedAt || maxAgeMs <= 0) return false;
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t)) return false;
  return now - t < maxAgeMs;
}

export function readCachedReadmeFetchedAt(
  owner: string,
  repo: string,
  root?: string,
): string | null {
  const { meta } = cachePaths(owner, repo, root);
  if (!existsSync(meta)) return null;
  try {
    const payload = JSON.parse(readFileSync(meta, "utf-8")) as {
      fetchedAt?: string;
    };
    return typeof payload.fetchedAt === "string" ? payload.fetchedAt : null;
  } catch {
    return null;
  }
}

/** Absolute path to the cached markdown file (for logging / verification). */
export function getReadmeCachePath(owner: string, repo: string): string {
  return cachePaths(owner, repo).md;
}

export function readCachedReadme(
  owner: string,
  repo: string,
): RepoReadmeDTO | null {
  const { md, meta } = cachePaths(owner, repo);
  if (!existsSync(md)) return null;
  try {
    const markdown = readFileSync(md, "utf-8");
    if (!markdown.trim()) return null;
    let cached: CachedReadmeMeta | null = null;
    if (existsSync(meta)) {
      cached = JSON.parse(readFileSync(meta, "utf-8")) as CachedReadmeMeta;
    }
    const fullName = `${owner}/${repo}`;
    return {
      fullName: cached?.fullName || fullName,
      name: cached?.name || "README.md",
      markdown,
      htmlUrl: cached?.htmlUrl || `https://github.com/${fullName}`,
      encoding: cached?.encoding || "utf-8",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[readme-cache] read failed ${owner}/${repo}: ${msg}`);
    return null;
  }
}

export function writeCachedReadme(
  owner: string,
  repo: string,
  readme: RepoReadmeDTO,
  root?: string,
): string {
  const { md, meta } = cachePaths(owner, repo, root);
  writeFileSync(md, readme.markdown, "utf-8");
  const payload: CachedReadmeMeta = {
    fullName: readme.fullName,
    name: readme.name,
    htmlUrl: readme.htmlUrl,
    encoding: "utf-8",
    fetchedAt: new Date().toISOString(),
  };
  writeFileSync(meta, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return md;
}

export interface CachedReadmeListItem {
  owner: string;
  repo: string;
  fullName: string;
  relativePath: string;
  fetchedAt: string | null;
  size: number;
}

/**
 * List on-disk README cache entries under `./readmes/{owner}/{repo}.md`
 * (or the configured root). Used by the web Settings page for review/download.
 */
export function listCachedReadmes(): CachedReadmeListItem[] {
  const root = resolveReadmesRoot();
  if (!existsSync(root)) return [];

  const items: CachedReadmeListItem[] = [];
  let owners: string[] = [];
  try {
    owners = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && REPO_NAME_RE.test(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }

  for (const owner of owners) {
    const dir = join(root, owner);
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((name) => name.endsWith(".md"));
    } catch {
      continue;
    }
    for (const file of files) {
      const repo = file.slice(0, -3);
      if (!REPO_NAME_RE.test(repo)) continue;
      const mdPath = join(dir, `${repo}.md`);
      const metaPath = join(dir, `${repo}.json`);
      let fetchedAt: string | null = null;
      try {
        if (existsSync(metaPath)) {
          const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
            fetchedAt?: string;
          };
          fetchedAt =
            typeof meta.fetchedAt === "string" ? meta.fetchedAt : null;
        }
      } catch {
        fetchedAt = null;
      }
      let size = 0;
      try {
        size = statSync(mdPath).size;
      } catch {
        continue;
      }
      items.push({
        owner,
        repo,
        fullName: `${owner}/${repo}`,
        relativePath: `${owner}/${repo}.md`,
        fetchedAt,
        size,
      });
    }
  }

  items.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return items;
}

/** Best-effort disk write — never fail the HTTP response on cache I/O errors. */
export function tryWriteCachedReadme(
  owner: string,
  repo: string,
  readme: RepoReadmeDTO,
): string | null {
  try {
    return writeCachedReadme(owner, repo, readme);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[readme-cache] write failed ${owner}/${repo}: ${msg.split("\n")[0]}`,
    );
    return null;
  }
}
