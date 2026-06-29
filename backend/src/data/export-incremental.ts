import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  getDb,
  getFeedItems,
  getLanguages,
  getTrendingDates,
  getStats,
} from "../db/index.js";
import { getDefaultDbPath } from "../db/paths.js";
import {
  type DataManifest,
  getTrendingDatesFromManifest,
  upsertManifestPath,
} from "./manifest-utils.js";

interface FeedChunk {
  items: unknown[];
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function readManifest(path: string): DataManifest {
  if (!existsSync(path)) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      feeds: { trending: [], starred: [] },
    };
  }
  return JSON.parse(readFileSync(path, "utf-8")) as DataManifest;
}

function exportTrendingChunk(
  db: ReturnType<typeof getDb>,
  outDir: string,
  date: string,
): FeedChunk | null {
  const trending = getFeedItems(db, "trending", { date }, 1, 100000);
  if (trending.items.length === 0) {
    return null;
  }

  const chunkPath = `chunks/trending/${date}.json`;
  writeFileSync(join(outDir, chunkPath), JSON.stringify(trending, null, 2));
  return trending;
}

function main() {
  const dbPath = getDefaultDbPath();
  const outDir = process.argv[2] || join(__dirname, "../../../frontend/public/data");
  const db = getDb(dbPath);
  const today = new Date().toISOString().slice(0, 10);

  const chunksDir = join(outDir, "chunks");
  const starredDir = join(chunksDir, "starred");
  mkdirSync(join(chunksDir, "trending"), { recursive: true });
  mkdirSync(starredDir, { recursive: true });

  const manifestPath = join(outDir, "manifest.json");
  const manifest = readManifest(manifestPath);

  // Export trending chunks for every snapshot date in DB (backfill missing dates).
  const dbDates = getTrendingDates(db);
  const datesToExport = Array.from(new Set([today, ...dbDates])).sort();

  for (const date of datesToExport) {
    const chunkPath = `chunks/trending/${date}.json`;
    const chunkExists = existsSync(join(outDir, chunkPath));
    if (chunkExists && date !== today) {
      manifest.feeds.trending = upsertManifestPath(manifest.feeds.trending, chunkPath);
      continue;
    }

    const trending = exportTrendingChunk(db, outDir, date);
    if (trending) {
      manifest.feeds.trending = upsertManifestPath(manifest.feeds.trending, chunkPath);
    }
  }

  const starredAll = getFeedItems(db, "starred", {}, 1, 100000);
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const starredRecent = {
    items: starredAll.items.filter(
      (item) => item.starredAt && item.starredAt >= recentCutoff,
    ),
  } as FeedChunk;

  const starredChunkPath = `chunks/starred/${today}.json`;
  writeFileSync(
    join(outDir, starredChunkPath),
    JSON.stringify(starredRecent, null, 2),
  );
  manifest.feeds.starred = upsertManifestPath(manifest.feeds.starred, starredChunkPath);

  const starredBootstrapPath = join(outDir, "starred.json");
  if (!existsSync(starredBootstrapPath)) {
    writeFileSync(starredBootstrapPath, JSON.stringify(starredAll, null, 2));
  }

  const trendingBootstrapPath = join(outDir, "trending.json");
  if (!existsSync(trendingBootstrapPath)) {
    const allTrending = getFeedItems(db, "trending", {}, 1, 100000);
    if (allTrending.items.length > 0) {
      writeFileSync(trendingBootstrapPath, JSON.stringify(allTrending, null, 2));
    }
  }

  manifest.generatedAt = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const publishedDates = getTrendingDatesFromManifest(manifest);
  writeFileSync(
    join(outDir, "languages.json"),
    JSON.stringify(getLanguages(db), null, 2),
  );
  writeFileSync(join(outDir, "dates.json"), JSON.stringify(publishedDates, null, 2));
  writeFileSync(join(outDir, "stats.json"), JSON.stringify(getStats(db), null, 2));

  console.log(
    `Exported incremental chunks: trending dates=${publishedDates.join(", ")}, starred=${starredRecent.items.length}`,
  );
}

main();
