import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
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
 * Avoids collisions across owners; configurable root via Settings /
 * `innate-feeds.config.json` / `READMES_DIR`.
 */
function cachePaths(owner: string, repo: string): { md: string; meta: string } {
  if (!REPO_NAME_RE.test(owner) || !REPO_NAME_RE.test(repo)) {
    throw new Error(`Invalid owner/repo for cache: ${owner}/${repo}`);
  }
  const root = resolveReadmesRoot();
  const dir = join(root, owner);
  mkdirSync(dir, { recursive: true });
  return {
    md: join(dir, `${repo}.md`),
    meta: join(dir, `${repo}.json`),
  };
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
): string {
  const { md, meta } = cachePaths(owner, repo);
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
