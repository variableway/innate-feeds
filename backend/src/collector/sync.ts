import {
  getDb,
  upsertTrendingRepo,
  upsertStarredRepo,
  insertTrendingTopics,
  insertStarredTopics,
  getLatestStarredAt,
  deleteTrendingSnapshot,
} from "../db/index.js";
import {
  fetchTrendingRepos,
  fetchStarredReposWithDate,
  type TrendingPeriod,
} from "./github.js";

/** Prefer gh scrape when Firecrawl returns an incomplete page. */
const MIN_FIRECRAWL_REPOS = 15;

export async function syncTrending(
  period: TrendingPeriod = "daily",
  dbPath?: string,
): Promise<number> {
  const db = getDb(dbPath);
  const snapshotDate = new Date().toISOString().split("T")[0];

  let repos: Awaited<ReturnType<typeof fetchTrendingRepos>> = [];
  try {
    const { fetchTrendingWithFirecrawl } = await import("./firecrawl.js");
    repos = await fetchTrendingWithFirecrawl(period);
  } catch (err) {
    console.warn("Firecrawl unavailable, using GitHub scrape:", err);
  }

  if (repos.length === 0 || repos.length < MIN_FIRECRAWL_REPOS) {
    if (repos.length > 0) {
      console.warn(
        `Firecrawl returned only ${repos.length} repos (< ${MIN_FIRECRAWL_REPOS}); trying GitHub scrape fallback`,
      );
    }
    const fallback = await fetchTrendingRepos(period);
    if (fallback.length >= repos.length) {
      repos = fallback;
    } else if (fallback.length > 0) {
      console.warn(
        `GitHub scrape returned ${fallback.length} repos; keeping Firecrawl result (${repos.length})`,
      );
    }
  }

  if (repos.length === 0) {
    console.error(`No trending repos fetched for ${period}; skipping DB write`);
    return 0;
  }

  const tx = db.transaction(() => {
    deleteTrendingSnapshot(db, snapshotDate, period);

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

  return tx();
}

export async function syncAllTrending(
  dbPath?: string,
): Promise<{ daily: number; weekly: number; monthly: number }> {
  const daily = await syncTrending("daily", dbPath);
  const weekly = await syncTrending("weekly", dbPath);
  const monthly = await syncTrending("monthly", dbPath);
  return { daily, weekly, monthly };
}

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
  } else if (days && days > 0) {
    stopAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    maxPages = 1000;
  } else {
    stopAt = getLatestStarredAt(db);
    if (!stopAt) {
      maxPages = 1000;
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

  return tx();
}
