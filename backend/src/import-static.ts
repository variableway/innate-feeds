import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  getDb,
  upsertTrendingRepo,
  upsertStarredRepo,
  insertTrendingTopics,
  insertStarredTopics,
} from "./db/index.js";
import { getDefaultDbPath } from "./db/paths.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

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

function loadJson(path: string): StaticFeedResponse | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as StaticFeedResponse;
}

function main() {
  const dbPath = getDefaultDbPath();
  const dataDir =
    process.argv[2] || join(__dirname, "../../frontend/public/data");

  const db = getDb(dbPath);

  const trending = loadJson(join(dataDir, "trending.json"));
  const starred = loadJson(join(dataDir, "starred.json"));

  if (!trending?.items.length && !starred?.items.length) {
    console.log("No static JSON data found to import");
    return;
  }

  console.log(`Importing static data from ${dataDir} into ${dbPath}...`);

  const tx = db.transaction(() => {
    let trendingCount = 0;
    let starredCount = 0;

    for (const item of trending?.items ?? []) {
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

    for (const item of starred?.items ?? []) {
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
  console.log(
    `Imported ${trendingCount} trending and ${starredCount} starred items`,
  );
}

main();
