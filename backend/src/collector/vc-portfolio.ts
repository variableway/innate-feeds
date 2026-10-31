/**
 * Unified external collectors sync orchestrator (GH #31).
 *
 * Coordinates every JSON-store FeedCollector: VC portfolios (YC + a16z),
 * Product Hunt, and the community feeds (Hacker News, Hugging Face,
 * fast-growing new GitHub repos, Dev.to, lobste.rs).
 *
 * Run:
 *   bunx tsx src/collector/vc-portfolio.ts --save
 *   bunx tsx src/collector/vc-portfolio.ts --source yc --save
 *   bunx tsx src/collector/vc-portfolio.ts --source hackernews --save
 */

import { YCCompaniesCollector } from "./yc-companies.js";
import { A16zPortfolioCollector } from "./a16z-portfolio.js";
import { ProductHuntCollector } from "./producthunt.js";
import { HackerNewsCollector } from "./hackernews.js";
import { HuggingFaceCollector } from "./huggingface.js";
import { GitHubNewCollector } from "./github-new.js";
import { DevToCollector } from "./devto.js";
import { LobstersCollector } from "./lobsters.js";
import type { FeedSource } from "./shared/types.js";

export type SyncTarget = FeedSource | "all";

export interface SyncOptions {
  sources?: SyncTarget[];
  ycBatches?: string[];
  ycQuery?: string;
  phDate?: string;
  /** github-new look-back window (days). */
  ghNewDays?: number;
}

/** Community feed collectors run one after another; failures don't abort the rest. */
async function runStep(name: string, step: () => Promise<void>): Promise<void> {
  console.log(`[vc-sync] Syncing ${name}...`);
  try {
    await step();
  } catch (err) {
    console.error(
      `[vc-sync] ${name} failed (continuing):`,
      err instanceof Error ? err.message : err,
    );
  }
}

export async function syncVCPortfolio(
  options: SyncOptions = {},
): Promise<void> {
  const sources = options.sources || ["all"];
  const targets: FeedSource[] = sources.includes("all")
    ? [
        "yc",
        "a16z",
        "producthunt",
        "hackernews",
        "huggingface",
        "github-new",
        "devto",
        "lobsters",
      ]
    : (sources as FeedSource[]);

  if (targets.includes("yc")) {
    await runStep("YC Companies", async () => {
      const yc = new YCCompaniesCollector({
        batches: options.ycBatches,
        query: options.ycQuery,
      });
      const results = await yc.save();
      for (const r of results) {
        console.log(
          `[vc-sync] YC batch ${r.source}: ${r.count} items -> ${r.outDir}`,
        );
      }
    });
  }

  if (targets.includes("a16z")) {
    await runStep("a16z Portfolio", async () => {
      const a16z = new A16zPortfolioCollector();
      const result = await a16z.save();
      console.log(`[vc-sync] a16z: ${result.count} items -> ${result.outDir}`);
    });
  }

  if (targets.includes("producthunt")) {
    await runStep("Product Hunt", async () => {
      const date = options.phDate || new Date().toISOString().split("T")[0];
      const ph = new ProductHuntCollector();
      const result = await ph.save(date);
      console.log(
        `[vc-sync] Product Hunt: ${result.count} items -> ${result.outDir}`,
      );
    });
  }

  if (targets.includes("hackernews")) {
    await runStep("Hacker News", async () => {
      const hn = new HackerNewsCollector();
      const result = await hn.save();
      console.log(
        `[vc-sync] Hacker News: ${result.count} items -> ${result.outDir}`,
      );
    });
  }

  if (targets.includes("huggingface")) {
    await runStep("Hugging Face", async () => {
      const hf = new HuggingFaceCollector();
      const result = await hf.save();
      console.log(
        `[vc-sync] Hugging Face: ${result.count} items -> ${result.outDir}`,
      );
    });
  }

  if (targets.includes("github-new")) {
    await runStep("GitHub new repos", async () => {
      const ghNew = new GitHubNewCollector({ days: options.ghNewDays });
      const result = await ghNew.save();
      console.log(
        `[vc-sync] GitHub new: ${result.count} items -> ${result.outDir}`,
      );
    });
  }

  if (targets.includes("devto")) {
    await runStep("Dev.to", async () => {
      const devto = new DevToCollector();
      const result = await devto.save();
      console.log(
        `[vc-sync] Dev.to: ${result.count} items -> ${result.outDir}`,
      );
    });
  }

  if (targets.includes("lobsters")) {
    await runStep("lobste.rs", async () => {
      const lobsters = new LobstersCollector();
      const result = await lobsters.save();
      console.log(
        `[vc-sync] lobste.rs: ${result.count} items -> ${result.outDir}`,
      );
    });
  }

  console.log("[vc-sync] Done.");
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /vc-portfolio\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const args = process.argv.slice(2);
  const sources: SyncTarget[] = [];
  let ycBatches: string[] | undefined;
  let ycQuery: string | undefined;
  let phDate: string | undefined;
  let ghNewDays: number | undefined;
  let save = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      sources.push(args[++i] as SyncTarget);
    }
    if (args[i] === "--batch" && args[i + 1]) {
      ycBatches = ycBatches || [];
      ycBatches.push(args[++i]);
    }
    if (args[i] === "--query" && args[i + 1]) ycQuery = args[++i];
    if (args[i] === "--date" && args[i + 1]) phDate = args[++i];
    if (args[i] === "--days" && args[i + 1])
      ghNewDays = parseInt(args[++i], 10);
    if (args[i] === "--save") save = true;
  }

  if (!save) {
    console.error("Use --save to persist data to disk.");
    process.exit(1);
  }

  syncVCPortfolio({
    sources: sources.length ? sources : ["all"],
    ycBatches,
    ycQuery,
    phDate,
    ghNewDays,
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
