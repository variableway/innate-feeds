import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  getDb,
  upsertTrendingRepo,
  upsertStarredRepo,
  insertTrendingTopics,
  insertStarredTopics,
} from "../db/index.js";
import { getDefaultDbPath } from "../db/paths.js";

interface StaticFeedItem {
  id: string;
  type: "trending" | "starred";
  snapshotDate?: string;
  starredAt?: string;
  repo: {
    id: number;
    name: string;
    fullName: string;
    description: string | null;
    url: string;
    homepage: string | null;
    stars: number;
    forks: number;
    watchers: number;
    language: string | null;
    topics: string[];
    owner: { login: string; avatarUrl: string; url: string };
    createdAt: string;
    updatedAt: string;
  };
}

interface StaticFeedResponse {
  items: StaticFeedItem[];
}

interface Manifest {
  feeds?: {
    trending?: string[];
    starred?: string[];
  };
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function collectFeedItems(dataDir: string): { trending: StaticFeedItem[]; starred: StaticFeedItem[] } {
  const legacyTrending =
    loadJson<StaticFeedResponse>(join(dataDir, "trending.json"))?.items ?? [];
  const legacyStarred =
    loadJson<StaticFeedResponse>(join(dataDir, "starred.json"))?.items ?? [];

  const manifest = loadJson<Manifest>(join(dataDir, "manifest.json"));
  const trendingPaths = manifest?.feeds?.trending ?? [];
  const starredPaths = manifest?.feeds?.starred ?? [];

  const trendingChunks = trendingPaths.flatMap(
    (p) => loadJson<StaticFeedResponse>(join(dataDir, p))?.items ?? [],
  );
  const starredChunks = starredPaths.flatMap(
    (p) => loadJson<StaticFeedResponse>(join(dataDir, p))?.items ?? [],
  );

  return {
    trending: [...legacyTrending, ...trendingChunks],
    starred: [...legacyStarred, ...starredChunks],
  };
}

function main() {
  const dbPath = getDefaultDbPath();
  const dataDir = process.argv[2] || join(__dirname, "../../../frontend/public/data");
  const db = getDb(dbPath);

  const { trending, starred } = collectFeedItems(dataDir);
  if (!trending.length && !starred.length) {
    console.log("No static JSON data found to import");
    return;
  }

  const tx = db.transaction(() => {
    let trendingCount = 0;
    let starredCount = 0;

    for (const item of trending) {
      if (item.type !== "trending" || !item.snapshotDate) continue;
      const periodMatch = item.id.match(
        /^trending-\d{4}-\d{2}-\d{2}-(daily|weekly|monthly)-/,
      );
      const period = periodMatch?.[1] || "daily";
      upsertTrendingRepo(db, {
        id: item.id,
        github_repo_id: item.repo.id,
        name: item.repo.name,
        full_name: item.repo.fullName,
        description: item.repo.description,
        url: item.repo.url,
        homepage: item.repo.homepage,
        stars: item.repo.stars,
        forks: item.repo.forks,
        watchers: item.repo.watchers,
        language: item.repo.language,
        owner_login: item.repo.owner.login,
        owner_avatar_url: item.repo.owner.avatarUrl,
        owner_url: item.repo.owner.url,
        created_at: item.repo.createdAt,
        updated_at: item.repo.updatedAt,
        period,
        snapshot_date: item.snapshotDate,
      });
      insertTrendingTopics(db, item.id, item.repo.topics || []);
      trendingCount++;
    }

    for (const item of starred) {
      if (item.type !== "starred") continue;
      upsertStarredRepo(db, {
        id: item.repo.id,
        name: item.repo.name,
        full_name: item.repo.fullName,
        description: item.repo.description,
        url: item.repo.url,
        homepage: item.repo.homepage,
        stars: item.repo.stars,
        forks: item.repo.forks,
        watchers: item.repo.watchers,
        language: item.repo.language,
        owner_login: item.repo.owner.login,
        owner_avatar_url: item.repo.owner.avatarUrl,
        owner_url: item.repo.owner.url,
        created_at: item.repo.createdAt,
        updated_at: item.repo.updatedAt,
        starred_at: item.starredAt || null,
      });
      insertStarredTopics(db, item.repo.id, item.repo.topics || []);
      starredCount++;
    }

    return { trendingCount, starredCount };
  });

  const { trendingCount, starredCount } = tx();
  console.log(`Imported ${trendingCount} trending and ${starredCount} starred items`);
}

main();
