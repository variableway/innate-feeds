import {
  syncTrending,
  syncAllTrending,
  syncStarred,
} from "../collector/sync.js";
import {
  getDb,
  getFeedItems,
  getStats,
  getTrendingDates,
} from "../db/index.js";
import { getDefaultDbPath } from "../db/paths.js";

const command = process.argv[2];
const dbPath = getDefaultDbPath();

function printUsage() {
  console.log(`
innate-feeds CLI

Usage:
  tsx src/app/cli.ts sync trending [daily|weekly|monthly]
  tsx src/app/cli.ts sync all-trending
  tsx src/app/cli.ts sync starred [user] [--force] [--days N]
  tsx src/app/cli.ts list [trending|starred]
  tsx src/app/cli.ts dates
  tsx src/app/cli.ts stats
`);
}

async function main() {
  switch (command) {
    case "sync": {
      const type = process.argv[3];
      if (type === "trending") {
        const period = (process.argv[4] || "daily") as
          | "daily"
          | "weekly"
          | "monthly";
        const count = await syncTrending(period, dbPath);
        console.log(`Synced ${count} ${period} trending repositories`);
      } else if (type === "all-trending") {
        const result = await syncAllTrending(dbPath);
        console.log(result);
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
        process.exit(1);
      }
      break;
    }
    case "list": {
      const db = getDb(dbPath);
      const type = process.argv[3] || "trending";
      const result = getFeedItems(db, type, {}, 1, 50);
      console.log(result.items.map((item) => item.repo.fullName).join("\n"));
      break;
    }
    case "dates": {
      const db = getDb(dbPath);
      console.log(getTrendingDates(db).join("\n"));
      break;
    }
    case "stats": {
      const db = getDb(dbPath);
      console.log(getStats(db));
      break;
    }
    default:
      printUsage();
  }
}

main().catch(console.error);
