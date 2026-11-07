import {
  syncTrending,
  syncAllTrending,
  syncStarred,
} from "../collectors/core/sync.js";
import { parseWindowArgs, syncWindow } from "../collectors/core/sync-window.js";
import {
  getDefaultDigestDir,
  parseDigestArgs,
  runDigestExport,
} from "../collectors/core/issues-digest.js";
import {
  getDb,
  getFeedItems,
  getStats,
  getTrendingDates,
  listKnownRepoFullNames,
  listNewStarredItems,
} from "../db/index.js";
import { writeFileSync } from "fs";
import { getDefaultDbPath } from "../db/paths.js";
import { ProductHuntCollector } from "../collectors/external/producthunt.js";
import { YCCompaniesCollector } from "../collectors/external/yc-companies.js";
import { A16zPortfolioCollector } from "../collectors/external/a16z-portfolio.js";
import { syncVCPortfolio } from "../collectors/external/vc-portfolio.js";
import { EduSkillsCollector } from "../collectors/vertical/edu-skills.js";
import { EduVideosCollector } from "../collectors/vertical/edu-videos.js";
import { HackerNewsCollector } from "../collectors/external/hackernews.js";
import { HuggingFaceCollector } from "../collectors/external/huggingface.js";
import { GitHubNewCollector } from "../collectors/external/github-new.js";
import { DevToCollector } from "../collectors/external/devto.js";
import { LobstersCollector } from "../collectors/external/lobsters.js";
import {
  listTopics,
  syncTopics,
  TOPIC_LIMIT,
} from "../collectors/core/github-topics.js";
import { saveItems } from "../collectors/shared/storage.js";
import { syncDshCatalog } from "../collectors/vertical/dsh-catalog.js";
import { syncAwesomeDsh } from "../collectors/vertical/awesome-dsh.js";
import {
  syncTrendshift,
  TRENDSHIFT_LANGUAGES,
  TRENDSHIFT_TIMEFRAMES,
  type TrendshiftLanguageFilter,
  type TrendshiftSource,
  type TrendshiftTimeframe,
} from "../collectors/external/trendshift.js";

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
  tsx src/app/cli.ts sync producthunt [--date YYYY-MM-DD] [--period daily|weekly|monthly|all]
  tsx src/app/cli.ts sync yc [--batch BATCH] [--query QUERY]
  tsx src/app/cli.ts sync a16z
  tsx src/app/cli.ts sync github-topics [--topic TOPIC] [--sort stars|updated] [--per-page N] [--limit N]
  tsx src/app/cli.ts sync trendshift [--timeframe all|daily|weekly|monthly|yearly] [--language slug[,slug]|*] [--source cdn|scrape|auto] [--no-save]
  tsx src/app/cli.ts sync dsh-catalog [--ref BRANCH] [--dry-run]
  tsx src/app/cli.ts sync awesome-dsh
  tsx src/app/cli.ts sync vc [--source yc|a16z|producthunt|github-topics] [--batch BATCH] [--date YYYY-MM-DD]
  tsx src/app/cli.ts sync edu-skills [--max N]
  tsx src/app/cli.ts sync edu-videos
  tsx src/app/cli.ts list [trending|starred] [--days N | --since ISO] [--json] [--out FILE] [--limit N]
  tsx src/app/cli.ts topics --list
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

List notes:
  'list starred' accepts a time cutoff on starred_at (GH #39): --days N
  (newest N days) or --since "2026-01-01T00:00:00Z". Output as one fullName
  per line by default, full JSON with --json, or written to a file with --out
  (implies --json). Example:
    bun run list:new-starred
    bun run list:starred -- --days 30 --json
    bun run list:starred -- --since 2026-10-01T00:00:00Z --out new-starred.json
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
      } else if (type === "producthunt") {
        const args = process.argv.slice(4);
        let date = new Date().toISOString().split("T")[0];
        let period: "daily" | "weekly" | "monthly" | "all" = "all";
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--date" && args[i + 1]) date = args[++i];
          if (args[i] === "--period" && args[i + 1]) {
            period = args[++i] as any;
          }
        }
        const ph = new ProductHuntCollector();
        if (period === "all") {
          const results = await ph.saveAll(date);
          console.log(
            JSON.stringify(
              results.map((r) => ({
                source: "producthunt",
                count: r.count,
                label: r.source,
                outDir: r.outDir,
                bytes: r.bytes,
              })),
              null,
              2,
            ),
          );
        } else {
          const result = await ph.savePeriod(period, date);
          console.log(
            JSON.stringify(
              {
                source: "producthunt",
                period,
                count: result.count,
                outDir: result.outDir,
                bytes: result.bytes,
              },
              null,
              2,
            ),
          );
        }
      } else if (type === "yc") {
        const args = process.argv.slice(4);
        const batches: string[] = [];
        let query = "ai";
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--batch" && args[i + 1]) batches.push(args[++i]);
          if (args[i] === "--query" && args[i + 1]) query = args[++i];
        }
        const yc = new YCCompaniesCollector({
          batches: batches.length ? batches : undefined,
          query,
        });
        const results = await yc.save();
        console.log(
          JSON.stringify(
            results.map((r) => ({
              source: "yc",
              count: r.count,
              outDir: r.outDir,
              bytes: r.bytes,
            })),
            null,
            2,
          ),
        );
      } else if (type === "a16z") {
        const a16z = new A16zPortfolioCollector();
        const result = await a16z.save();
        console.log(
          JSON.stringify(
            {
              source: "a16z",
              count: result.count,
              outDir: result.outDir,
              bytes: result.bytes,
            },
            null,
            2,
          ),
        );
      } else if (
        type === "hackernews" ||
        type === "huggingface" ||
        type === "github-new" ||
        type === "devto" ||
        type === "lobsters"
      ) {
        // GH #31 community feed collectors
        const args = process.argv.slice(4);
        let days = 7;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--days" && args[i + 1])
            days = parseInt(args[++i], 10);
        }
        const result = await (async () => {
          switch (type) {
            case "hackernews":
              return new HackerNewsCollector().save();
            case "huggingface":
              return new HuggingFaceCollector().save();
            case "github-new":
              return new GitHubNewCollector({ days }).save();
            case "devto":
              return new DevToCollector().save();
            default:
              return new LobstersCollector().save();
          }
        })();
        console.log(
          JSON.stringify(
            {
              source: type,
              count: result.count,
              outDir: result.outDir,
              bytes: result.bytes,
            },
            null,
            2,
          ),
        );
      } else if (type === "vc") {
        const args = process.argv.slice(4);
        const sources: string[] = [];
        const ycBatches: string[] = [];
        let ycQuery: string | undefined;
        let phDate: string | undefined;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--source" && args[i + 1]) sources.push(args[++i]);
          if (args[i] === "--batch" && args[i + 1]) ycBatches.push(args[++i]);
          if (args[i] === "--query" && args[i + 1]) ycQuery = args[++i];
          if (args[i] === "--date" && args[i + 1]) phDate = args[++i];
        }
        await syncVCPortfolio({
          sources: sources.length ? (sources as any) : ["all"],
          ycBatches: ycBatches.length ? ycBatches : undefined,
          ycQuery,
          phDate,
        });
      } else if (type === "edu-skills") {
        const args = process.argv.slice(4);
        let max = 600;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--max" && args[i + 1]) max = Number(args[++i]);
        }
        const collector = new EduSkillsCollector(max);
        const result = await collector.save();
        console.log(
          JSON.stringify(
            {
              source: "edu-skills",
              count: result.count,
              outDir: result.outDir,
              bytes: result.bytes,
            },
            null,
            2,
          ),
        );
      } else if (type === "edu-videos") {
        const collector = new EduVideosCollector();
        const result = await collector.save();
        console.log(
          JSON.stringify(
            {
              source: "edu-videos",
              count: result.count,
              outDir: result.outDir,
              bytes: result.bytes,
            },
            null,
            2,
          ),
        );
      } else if (type === "github-topics") {
        const args = process.argv.slice(4);
        const topics: string[] = [];
        let sort: "stars" | "updated" = "stars";
        let perPage: number | undefined;
        let limit = TOPIC_LIMIT;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--topic" && args[i + 1]) topics.push(args[++i]);
          if (args[i] === "--sort" && args[i + 1]) sort = args[++i] as any;
          if (args[i] === "--per-page" && args[i + 1])
            perPage = Number(args[++i]);
          if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
        }

        // Repos already known to the trending/starred feeds count as
        // "existing" (GH #24): they are not reported as new discoveries.
        let existingFullNames: string[] = [];
        try {
          existingFullNames = [...listKnownRepoFullNames(getDb(dbPath))];
        } catch {
          /* no database yet — treat every repo as new */
        }

        const results = await syncTopics({
          topics: topics.length ? topics : undefined,
          sort,
          perPage,
          limit,
          existingFullNames,
        });

        // Keep the merged daily snapshot for the admin JSON workspace.
        const merged = [
          ...new Map(
            results.flatMap((r) => r.items).map((i) => [i.url, i]),
          ).values(),
        ];
        const today = new Date().toISOString().split("T")[0];
        const saved = saveItems("github-topics", merged, `topics-${today}`);

        console.log(
          JSON.stringify(
            {
              source: "github-topics",
              topics: results.map((r) => ({
                topic: r.topic,
                count: r.count,
                new: r.newCount,
                skippedExisting: r.skippedExisting,
                skippedSeen: r.skippedSeen,
              })),
              merged: saved.count,
              outDir: saved.outDir,
              bytes: saved.bytes,
            },
            null,
            2,
          ),
        );
      } else if (type === "trendshift") {
        const args = process.argv.slice(4);
        const opts: {
          timeframes?: TrendshiftTimeframe[];
          languages?: TrendshiftLanguageFilter[];
          source?: TrendshiftSource | "auto";
          save?: boolean;
        } = {};
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--timeframe" && args[i + 1]) {
            const vals = args[++i].split(",").map((s) => s.trim());
            opts.timeframes = vals.includes("all")
              ? [...TRENDSHIFT_TIMEFRAMES]
              : (vals as TrendshiftTimeframe[]);
          } else if (args[i] === "--language" && args[i + 1]) {
            const vals = args[++i]
              .split(",")
              .map((s) => s.trim().toLowerCase());
            opts.languages = vals.includes("*")
              ? [...TRENDSHIFT_LANGUAGES]
              : (vals as TrendshiftLanguageFilter[]);
          } else if (args[i] === "--source" && args[i + 1]) {
            opts.source = args[++i] as TrendshiftSource | "auto";
          } else if (args[i] === "--no-save") {
            opts.save = false;
          }
        }
        const summary = await syncTrendshift(opts);
        console.log(
          JSON.stringify(
            {
              origin: summary.origin,
              files: summary.files.map((f) => `${f.path} (${f.count})`),
              totalRows: summary.totalRows,
              bytes: summary.bytes,
              outDir: summary.outDir,
            },
            null,
            2,
          ),
        );
      } else if (type === "dsh-catalog") {
        const args = process.argv.slice(4);
        const dryRun = args.includes("--dry-run");
        const refIdx = args.indexOf("--ref");
        const ref = refIdx >= 0 ? args[refIdx + 1] : undefined;
        const result = await syncDshCatalog({ ref, dryRun });
        console.log(JSON.stringify(result, null, 2));
      } else if (type === "awesome-dsh") {
        const summary = await syncAwesomeDsh();
        console.log(
          JSON.stringify(
            {
              source: "awesome-dsh",
              ...summary,
            },
            null,
            2,
          ),
        );
      } else {
        process.exit(1);
      }
      break;
    }
    case "list": {
      const db = getDb(dbPath);
      const type = process.argv[3] || "trending";
      const args = process.argv.slice(4);
      const daysIdx = args.indexOf("--days");
      const sinceIdx = args.indexOf("--since");
      const limitIdx = args.indexOf("--limit");
      const outIdx = args.indexOf("--out");
      const json = args.includes("--json") || outIdx >= 0;
      const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1], 10) : undefined;
      const since = sinceIdx >= 0 ? args[sinceIdx + 1] : undefined;
      const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 50;
      const outPath = outIdx >= 0 ? args[outIdx + 1] : undefined;

      if (type === "starred" && (days != null || since)) {
        // Time-filtered "new starred" view (GH #39).
        if (days != null && (!Number.isFinite(days) || days <= 0)) {
          console.error("--days must be a positive integer");
          process.exit(1);
        }
        if (sinceIdx >= 0 && !since) {
          console.error("--since requires an ISO timestamp value");
          process.exit(1);
        }
        const items = listNewStarredItems(db, { days, since }, limit || 500);
        if (json) {
          const payload = JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              since,
              days: days ?? null,
              count: items.length,
              items,
            },
            null,
            2,
          );
          if (outPath) {
            writeFileSync(outPath, payload);
            console.log(`Wrote ${items.length} new starred repos to ${outPath}`);
          } else {
            console.log(payload);
          }
        } else {
          console.log(items.map((item) => item.repo.fullName).join("\n"));
        }
        break;
      }

      const result = getFeedItems(db, type, {}, 1, limit);
      console.log(result.items.map((item) => item.repo.fullName).join("\n"));
      break;
    }
    case "topics": {
      const sub = process.argv[3];
      if (sub === "--list" || sub === "list") {
        listTopics();
      } else {
        console.log("Usage: tsx src/app/cli.ts topics --list");
      }
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
