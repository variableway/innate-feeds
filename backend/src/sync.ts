import {
  getDb,
  upsertTrendingRepo,
  upsertStarredRepo,
  insertTrendingTopics,
  insertStarredTopics,
  getLatestStarredAt,
} from "./db/index.js";
import {
  fetchTrendingRepos,
  fetchStarredReposWithDate,
  type TrendingPeriod,
} from "./github.js";

/**
 * Sync trending repos using Firecrawl (preferred) or GitHub API (fallback)
 */
export async function syncTrending(
  period: TrendingPeriod = "daily",
  dbPath?: string,
): Promise<number> {
  const db = getDb(dbPath);
  const snapshotDate = new Date().toISOString().split("T")[0];

  console.log(`Syncing ${period} trending repositories for ${snapshotDate}...`);

  // Try Firecrawl first, fallback to GitHub API (lazy import keeps API server bootable)
  let repos: Awaited<ReturnType<typeof fetchTrendingRepos>> = [];
  try {
    const { fetchTrendingWithFirecrawl } = await import("./firecrawl.js");
    repos = await fetchTrendingWithFirecrawl(period);
  } catch (err) {
    console.warn("Firecrawl unavailable, using GitHub API:", err);
  }
  if (repos.length === 0) {
    console.log("Firecrawl returned no results, falling back to GitHub API...");
    repos = fetchTrendingRepos(period);
  }

  const tx = db.transaction(() => {
    let count = 0;
    for (const repo of repos) {
      try {
        const id = `trending-${snapshotDate}-${period}-${repo.id}`;
        upsertTrendingRepo(db, {
          id,
          github_repo_id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          homepage: repo.homepage,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          watchers: repo.watchers_count,
          language: repo.language,
          owner_login: repo.owner.login,
          owner_avatar_url: repo.owner.avatar_url,
          owner_url: repo.owner.html_url,
          created_at: repo.created_at,
          updated_at: repo.updated_at,
          period,
          snapshot_date: snapshotDate,
        });

        insertTrendingTopics(db, id, repo.topics || []);

        count++;
      } catch (err) {
        console.error(`Error syncing repo ${repo.full_name}:`, err);
      }
    }
    return count;
  });

  const count = tx();
  console.log(`Successfully synced ${count} ${period} trending repositories`);
  return count;
}

/**
 * Sync all periods
 */
export async function syncAllTrending(
  dbPath?: string,
): Promise<{ daily: number; weekly: number; monthly: number }> {
  const daily = await syncTrending("daily", dbPath);
  const weekly = await syncTrending("weekly", dbPath);
  const monthly = await syncTrending("monthly", dbPath);
  return { daily, weekly, monthly };
}

/**
 * Sync starred repos.
 *
 * By default this is incremental: it fetches repos sorted by starred date
 * descending and stops as soon as it reaches a repo already stored in the DB.
 *
 * Options:
 * - force: full re-sync from the beginning (useful for first run or refresh).
 *          Uses a higher page limit so it can handle more than 5,000 repos.
 * - days:  only fetch repos starred within the last N days. This is useful for
 *          periodic jobs (e.g. every 5 days) and avoids walking the entire list.
 *          When days is set, the sync ignores the DB watermark and stops at
 *          (now - days).
 */
export function syncStarred(
  username?: string,
  dbPath?: string,
  force = false,
  days?: number,
): number {
  const db = getDb(dbPath);

  let stopAt: string | null = null;
  let maxPages = 50;

  if (force) {
    maxPages = 1000;
    console.log(
      `Full syncing starred repositories (up to ${maxPages * 100} repos)...`,
    );
  } else if (days && days > 0) {
    stopAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    maxPages = 1000;
    console.log(
      `Syncing starred repositories from the last ${days} days (since ${stopAt})...`,
    );
  } else {
    stopAt = getLatestStarredAt(db);
    if (stopAt) {
      console.log(
        `Incrementally syncing starred repositories since ${stopAt}...`,
      );
    } else {
      maxPages = 1000;
      console.log(
        `Full syncing starred repositories (up to ${maxPages * 100} repos)...`,
      );
    }
  }

  const items = fetchStarredReposWithDate({
    username,
    maxPages,
    sort: "created",
    direction: "desc",
    stopAt,
  });

  const tx = db.transaction(() => {
    let count = 0;
    for (const { repo, starred_at } of items) {
      try {
        upsertStarredRepo(db, {
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          homepage: repo.homepage,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          watchers: repo.watchers_count,
          language: repo.language,
          owner_login: repo.owner.login,
          owner_avatar_url: repo.owner.avatar_url,
          owner_url: repo.owner.html_url,
          created_at: repo.created_at,
          updated_at: repo.updated_at,
          starred_at,
        });

        insertStarredTopics(db, repo.id, repo.topics || []);

        count++;
      } catch (err) {
        console.error(`Error syncing repo ${repo.full_name}:`, err);
      }
    }
    return count;
  });

  const count = tx();
  console.log(`Successfully synced ${count} starred repositories`);
  return count;
}
