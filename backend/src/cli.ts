import { syncTrending, syncAllTrending, syncStarred } from "./sync.js";
import { getDb, getFeedItems, getStats, getTrendingDates } from "./db/index.js";
import { getDefaultDbPath } from "./db/paths.js";

const command = process.argv[2];
const dbPath = getDefaultDbPath();

function printUsage() {
  console.log(`
innate-feeds CLI

Usage:
  tsx src/cli.ts sync trending [daily|weekly|monthly]  Sync trending repos (default: daily)
  tsx src/cli.ts sync all-trending                     Sync all periods
  tsx src/cli.ts sync starred [user] [--force] [--days N]  Sync starred repos (incremental by default)
  tsx src/cli.ts list [trending|starred]               List feed items
  tsx src/cli.ts dates                                 List available trending dates
  tsx src/cli.ts stats                                 Show feed statistics

Environment:
  DB_PATH       Path to SQLite database (default: ~/.innate/feeds.db)
  INNATE_HOME   Directory for local data (default: ~/.innate)
  `);
}

async function main() {
  switch (command) {
    case "sync": {
      const type = process.argv[3];
      if (type === "trending") {
        const period = (process.argv[4] || "daily") as
          "daily" | "weekly" | "monthly";
        if (!["daily", "weekly", "monthly"].includes(period)) {
          console.error("Invalid period. Use 'daily', 'weekly', or 'monthly'");
          process.exit(1);
        }
        const count = await syncTrending(period, dbPath);
        console.log(`Synced ${count} ${period} trending repositories`);
      } else if (type === "all-trending") {
        const result = await syncAllTrending(dbPath);
        console.log(`\nSynced trending repositories:`);
        console.log(`  Daily: ${result.daily}`);
        console.log(`  Weekly: ${result.weekly}`);
        console.log(`  Monthly: ${result.monthly}`);
      } else if (type === "starred") {
        const args = process.argv.slice(4);
        const force = args.includes("--force");
        const daysIdx = args.indexOf("--days");
        const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1], 10) : undefined;
        const username = args.find(
          (arg) => !arg.startsWith("--") && arg !== args[daysIdx + 1],
        );
        const count = syncStarred(username, dbPath, force, days);
        console.log(`Synced ${count} starred repositories`);
      } else {
        console.error(
          "Unknown sync type. Use 'trending', 'all-trending', or 'starred'",
        );
        process.exit(1);
      }
      break;
    }

    case "list": {
      const db = getDb(dbPath);
      const type = process.argv[3] || "trending";
      const date = process.argv[4];

      const filters: any = {};
      if (date) filters.date = date;

      const result = getFeedItems(db, type, filters, 1, 50);

      console.log(
        `\n${type.toUpperCase()} Repositories (${result.total} total):`,
      );
      if (date) console.log(`Date: ${date}`);
      console.log("");

      for (const item of result.items) {
        const stars = "★".repeat(
          Math.min(5, Math.floor(item.repo.stars / 1000)),
        );
        const dateLabel = item.snapshotDate ? ` (${item.snapshotDate})` : "";
        console.log(`${stars} ${item.repo.fullName}${dateLabel}`);
        console.log(
          `   ⭐ ${item.repo.stars.toLocaleString()} | 🔀 ${item.repo.forks.toLocaleString()} | ${item.repo.language || "N/A"}`,
        );
        if (item.repo.description) {
          console.log(
            `   ${item.repo.description.substring(0, 80)}${item.repo.description.length > 80 ? "..." : ""}`,
          );
        }
        console.log("");
      }
      break;
    }

    case "dates": {
      const db = getDb(dbPath);
      const dates = getTrendingDates(db);
      console.log("\nAvailable Trending Dates:");
      for (const date of dates) {
        console.log(`  ${date}`);
      }
      break;
    }

    case "stats": {
      const db = getDb(dbPath);
      const stats = getStats(db);
      console.log("\nFeed Statistics:");
      console.log(`  Total Repos: ${stats.totalRepos.toLocaleString()}`);
      console.log(`  Trending: ${stats.trendingCount.toLocaleString()}`);
      console.log(`  Starred: ${stats.starredCount.toLocaleString()}`);

      console.log("\nTop Languages:");
      for (const lang of stats.topLanguages) {
        console.log(`  ${lang.language}: ${lang.count.toLocaleString()}`);
      }
      break;
    }

    default:
      printUsage();
  }
}

main().catch(console.error);
