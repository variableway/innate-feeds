import { cpSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  DigestFetchResult,
  DigestItemLocal,
} from "../collector/issues-digest.js";
import {
  getFrontendPublicDataDir,
  getStaticReadmesDir,
  resolveReadmesRoot,
} from "./app-config.js";

export interface StaticDigestItem {
  id: string;
  type: "digest";
  source: DigestItemLocal["source"];
  sourceRepo: string;
  title: string;
  category: string | null;
  excerpt: string;
  /** Kept so API dump reload can map back to DigestItemLocal.bodyExcerpt. */
  bodyExcerpt: string;
  bodyMarkdown: string | null;
  primaryUrl: string | null;
  githubRepoFullName: string | null;
  issueUrl: string;
  issueNumber: number;
  authorLogin: string;
  authorAvatarUrl: string | null;
  issueCreatedAt: string;
  issueUpdatedAt: string;
  labels: string[];
  comments: number;
  state: string;
  fetchedAt: string;
}

export interface StaticDigestPayload {
  fetchedAt: string;
  since: string | null;
  until: string | null;
  createdOnly: boolean;
  count: number;
  items: StaticDigestItem[];
}

export function toStaticDigestItem(
  item: DigestItemLocal,
  fetchedAt: string,
): StaticDigestItem {
  const excerpt = item.bodyExcerpt || "";
  return {
    id: item.id,
    type: "digest",
    source: item.source,
    sourceRepo: item.sourceRepo,
    title: item.title,
    category: item.category,
    excerpt,
    bodyExcerpt: excerpt,
    bodyMarkdown: item.bodyMarkdown,
    primaryUrl: item.primaryUrl,
    githubRepoFullName: item.githubRepoFullName,
    issueUrl: item.issueUrl,
    issueNumber: item.issueNumber,
    authorLogin: item.authorLogin,
    authorAvatarUrl: item.authorAvatarUrl || null,
    issueCreatedAt: item.issueCreatedAt,
    issueUpdatedAt: item.issueUpdatedAt,
    labels: item.labels ?? [],
    comments: item.comments ?? 0,
    state: item.state,
    fetchedAt,
  };
}

export function writeDigestSnapshot(
  result: DigestFetchResult,
  outDir: string = getFrontendPublicDataDir(),
): { path: string; count: number } {
  mkdirSync(outDir, { recursive: true });
  const payload: StaticDigestPayload = {
    fetchedAt: result.fetchedAt,
    since: result.since ?? null,
    until: result.until ?? null,
    createdOnly: result.createdOnly,
    count: result.items.length,
    items: result.items.map((item) =>
      toStaticDigestItem(item, result.fetchedAt),
    ),
  };
  const path = join(outDir, "digest.json");
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf-8");
  return { path, count: payload.count };
}

/** Copy `./readmes/{owner}/{repo}.md` into `frontend/public/data/readmes` for Pages. */
export function copyReadmesToPublic(): { copied: boolean; dest: string } {
  const src = resolveReadmesRoot();
  const dest = getStaticReadmesDir();
  if (!existsSync(src)) {
    return { copied: false, dest };
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  return { copied: true, dest };
}
