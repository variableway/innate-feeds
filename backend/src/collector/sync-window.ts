import { join } from "path";
import {
  getDb,
  listStarredFullNamesSince,
  listTrendingFullNamesSince,
} from "../db/index.js";
import { getDefaultDbPath } from "../db/paths.js";
import { getDefaultDigestDir, runDigestExport } from "./issues-digest.js";
import { prefetchReadmes } from "./prefetch-readmes.js";
import { syncAllTrending, syncStarred } from "./sync.js";
import {
  getFrontendPublicDataDir,
  getStaticReadmesDir,
} from "../data/app-config.js";
import {
  DEFAULT_SYNC_WINDOW_DAYS,
  dateDaysAgo,
  isoDaysAgo,
} from "../data/date-window.js";
import {
  getDigestGithubRepoFullNames,
  writeStaticDigestJson,
} from "../data/digest-store.js";

export { DEFAULT_SYNC_WINDOW_DAYS, dateDaysAgo };

export interface SyncWindowOptions {
  days?: number;
  dbPath?: string;
  username?: string;
  skipTrending?: boolean;
  skipStarred?: boolean;
  skipDigest?: boolean;
  skipReadme?: boolean;
  /** Refetch READMEs even when the cache is fresh. */
  forceReadme?: boolean;
}

export interface SyncWindowResult {
  days: number;
  since: string;
  trending?: { daily: number; weekly: number; monthly: number };
  starred?: number;
  digest?: { synced: number; files: string[] };
  readmes?: {
    fetched: number;
    skipped: number;
    failed: number;
    candidates: number;
  };
}

export function parseWindowArgs(argv: string[]): SyncWindowOptions {
  const opts: SyncWindowOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--days" && argv[i + 1]) {
      opts.days = parseInt(argv[++i]!, 10);
    } else if (a === "--skip-trending") opts.skipTrending = true;
    else if (a === "--skip-starred") opts.skipStarred = true;
    else if (a === "--skip-digest") opts.skipDigest = true;
    else if (a === "--skip-readme") opts.skipReadme = true;
    else if (a === "--force" || a === "--force-readme") opts.forceReadme = true;
    else if (a === "--username" && argv[i + 1]) opts.username = argv[++i];
    else if (a && !a.startsWith("--") && !opts.username) opts.username = a;
  }
  return opts;
}

/**
 * Lookback sync for static builds and local cache:
 * current trending snapshots, starred repos in the window, digest issues
 * created in the window, and README prefetch for those repos.
 *
 * GitHub Trending itself has no historical API — "last 3 months trending"
 * means today's daily/weekly/monthly lists plus READMEs for repos that
 * already appear in stored snapshots in that window.
 */
export async function syncWindow(
  options: SyncWindowOptions = {},
): Promise<SyncWindowResult> {
  const days =
    options.days && options.days > 0 ? options.days : DEFAULT_SYNC_WINDOW_DAYS;
  const since = dateDaysAgo(days);
  const sinceIso = isoDaysAgo(days);
  const dbPath = options.dbPath || getDefaultDbPath();
  const result: SyncWindowResult = { days, since };

  if (!options.skipTrending) {
    console.log("[window] sync trending (daily/weekly/monthly)");
    result.trending = await syncAllTrending(dbPath);
  }

  if (!options.skipStarred) {
    console.log(`[window] sync starred --days ${days}`);
    result.starred = syncStarred(options.username, dbPath, false, days);
  }

  if (!options.skipDigest) {
    console.log(`[window] sync digest since ${since} (created-only)`);
    const { result: digest, saved } = await runDigestExport({
      since,
      createdOnly: true,
      save: true,
      outDir: getDefaultDigestDir(),
      maxPages: 20,
      perPage: 100,
    });
    const staticPath = join(getFrontendPublicDataDir(), "digest.json");
    writeStaticDigestJson(staticPath, digest);
    result.digest = {
      synced: digest.items.length,
      files: [...(saved?.files ?? []), staticPath],
    };
  }

  if (!options.skipReadme) {
    const db = getDb(dbPath);
    const starredNames = listStarredFullNamesSince(db, sinceIso);
    const trendingNames = listTrendingFullNamesSince(db, since);
    const digestRepos = getDigestGithubRepoFullNames();
    const names = [
      ...new Set([...starredNames, ...trendingNames, ...digestRepos]),
    ];
    console.log(
      `[window] prefetch READMEs candidates=${names.length} (starred=${starredNames.length}, trending=${trendingNames.length}, digest=${digestRepos.length})`,
    );
    const prefetch = await prefetchReadmes(names, {
      force: options.forceReadme,
      extraRoots: [getStaticReadmesDir()],
    });
    result.readmes = {
      fetched: prefetch.fetched,
      skipped: prefetch.skipped,
      failed: prefetch.failed,
      candidates: names.length,
    };
  }

  return result;
}
