import {
  syncTrending,
  syncAllTrending,
  syncStarred,
} from "../collector/sync.js";
import { parseWindowArgs, syncWindow } from "../collector/sync-window.js";
import {
  getDefaultDigestDir,
  parseDigestArgs,
  runDigestExport,
} from "../collector/issues-digest.js";
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
  tsx src/app/cli.ts sync digest [--since YYYY-MM-DD | --days N] [--until YYYY-MM-DD] [--created-only] [--out DIR] [--source ID]
  tsx src/app/cli.ts sync window [--days 90] [--skip-trending] [--skip-starred] [--skip-digest] [--skip-readme] [--force]
  tsx src/app/cli.ts list [trending|starred]
  tsx src/app/cli.ts dates
  tsx src/app/cli.ts stats

Digest notes:
  Writes JSON under ~/.innate/digest/ by default (override with --out).
  Also copies a frontend snapshot to frontend/public/data/digest.json via sync window.
  Does not touch trending/starred SQLite tables.
  Examples:
    bun run sync:digest -- --days 90
    bun run sync:digest -- --since 2026-08-01
    bun run export:digest-local -- --since 2026-08-01 --until 2026-09-01 --created-only

Window notes:
  Default --days 90: current trending snapshots, starred since cutoff,
  digest issues created in-window, README prefetch (./readmes + frontend/public/data/readmes).
  Example:
    bun run sync:window
    bun run sync:window -- --days 90 --skip-readme
    bun run sync:window -- --force
`);
}

async function main() {
  switch (command) {
    case "sync": {
      const type = process.argv[3];
      if (type === "trending") {
        const period = (process.argv[4] || "daily") as
          "daily" | "weekly" | "monthly";
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
      } else if (type === "digest") {
        const args = parseDigestArgs(process.argv.slice(4));
        const { result, saved } = await runDigestExport({
          ...args,
          save: true,
          outDir: args.outDir || getDefaultDigestDir(),
        });
        console.log(
          JSON.stringify(
            {
              synced: result.items.length,
              transport: result.transport,
              since: result.since ?? null,
              until: result.until ?? null,
              createdOnly: result.createdOnly,
              bySource: result.bySource,
              outDir: saved?.outDir,
              files: saved?.files,
              bytes: saved?.bytes,
            },
            null,
            2,
          ),
        );
      } else if (type === "window") {
        const summary = await syncWindow(
          parseWindowArgs(process.argv.slice(4)),
        );
        console.log(JSON.stringify(summary, null, 2));
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
