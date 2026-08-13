import { fetchRepoReadmeRemote } from "./github.js";
import {
  readCachedReadmeFetchedAt,
  shouldSkipReadmeRefresh,
  tryWriteCachedReadme,
  writeCachedReadme,
} from "../data/readme-cache.js";

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PrefetchReadmesOptions {
  /** Always refetch, even if a fresh cache entry exists. */
  force?: boolean;
  /** Skip remote fetch when cache `fetchedAt` is newer than this (default 7 days). */
  maxAgeMs?: number;
  concurrency?: number;
  /** Extra roots to mirror into (e.g. `frontend/public/data/readmes`). */
  extraRoots?: string[];
}

export interface PrefetchReadmesResult {
  fetched: number;
  skipped: number;
  failed: number;
  names: string[];
}

function parseFullName(
  fullName: string,
): { owner: string; repo: string } | null {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, concurrency);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        const item = items[i];
        if (item === undefined) return;
        await fn(item);
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Fetch READMEs for `owner/repo` names. Writes the on-demand cache first
 * (`./readmes`), then mirrors into any `extraRoots` (static snapshot).
 *
 * Interactive API mode still refreshes in the background on each view;
 * this batch path skips files newer than `maxAgeMs` unless `--force`.
 */
export async function prefetchReadmes(
  fullNames: string[],
  options: PrefetchReadmesOptions = {},
): Promise<PrefetchReadmesResult> {
  const unique = [
    ...new Set(fullNames.map((n) => n.trim()).filter((n) => n.includes("/"))),
  ];
  const force = Boolean(options.force);
  const maxAgeMs = force ? 0 : (options.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const extraRoots = options.extraRoots ?? [];

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  await mapPool(unique, concurrency, async (fullName) => {
    const parts = parseFullName(fullName);
    if (!parts) {
      failed += 1;
      return;
    }
    const { owner, repo } = parts;
    const fetchedAt = readCachedReadmeFetchedAt(owner, repo);
    if (shouldSkipReadmeRefresh(fetchedAt, maxAgeMs)) {
      skipped += 1;
      return;
    }
    try {
      const readme = await fetchRepoReadmeRemote(owner, repo);
      tryWriteCachedReadme(owner, repo, readme);
      for (const root of extraRoots) {
        try {
          writeCachedReadme(owner, repo, readme, root);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[readme] mirror failed ${fullName} → ${root}: ${msg.split("\n")[0]}`,
          );
        }
      }
      fetched += 1;
      console.log(`[readme] prefetched ${fullName}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[readme] prefetch failed ${fullName}: ${msg.split("\n")[0]}`,
      );
    }
  });

  return { fetched, skipped, failed, names: unique };
}
