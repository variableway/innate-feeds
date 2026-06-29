import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getDb,
  getFeedItems,
  getLanguages,
  getTrendingDates,
  getStats,
} from "./db/index.js";
import { getDefaultDbPath } from "./db/paths.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function main() {
  const dbPath = getDefaultDbPath();
  const outDir =
    process.argv[2] || join(__dirname, "../../frontend/public/data");

  const db = getDb(dbPath);

  mkdirSync(outDir, { recursive: true });

  console.log(`Exporting static data from ${dbPath} to ${outDir}...`);

  // Export all trending and starred items for client-side filtering.
  const trending = getFeedItems(db, "trending", {}, 1, 100000);
  const starred = getFeedItems(db, "starred", {}, 1, 100000);
  const languages = getLanguages(db);
  const dates = getTrendingDates(db);
  const stats = getStats(db);

  writeFileSync(
    join(outDir, "trending.json"),
    JSON.stringify(trending, null, 2),
  );
  writeFileSync(join(outDir, "starred.json"), JSON.stringify(starred, null, 2));
  writeFileSync(
    join(outDir, "languages.json"),
    JSON.stringify(languages, null, 2),
  );
  writeFileSync(join(outDir, "dates.json"), JSON.stringify(dates, null, 2));
  writeFileSync(join(outDir, "stats.json"), JSON.stringify(stats, null, 2));

  console.log(`Exported:`);
  console.log(`  - trending.json: ${trending.items.length} items`);
  console.log(`  - starred.json: ${starred.items.length} items`);
  console.log(`  - languages.json: ${languages.length} languages`);
  console.log(`  - dates.json: ${dates.length} dates`);
}

main();
