/**
 * Unified VC Portfolio sync orchestrator.
 *
 * Coordinates YC + a16z collectors. Optionally includes Product Hunt.
 *
 * Run:
 *   bunx tsx src/collector/vc-portfolio.ts --save
 *   bunx tsx src/collector/vc-portfolio.ts --source yc --save
 *   bunx tsx src/collector/vc-portfolio.ts --source a16z --save
 *   bunx tsx src/collector/vc-portfolio.ts --source producthunt --date 2026-08-25 --save
 */

import { YCCompaniesCollector } from "./yc-companies.js";
import { A16zPortfolioCollector } from "./a16z-portfolio.js";
import { ProductHuntCollector } from "./producthunt.js";
import type { FeedSource } from "./shared/types.js";

export type SyncTarget = FeedSource | "all";

export interface SyncOptions {
  sources?: SyncTarget[];
  ycBatches?: string[];
  ycQuery?: string;
  phDate?: string;
}

export async function syncVCPortfolio(
  options: SyncOptions = {},
): Promise<void> {
  const sources = options.sources || ["all"];
  const targets: FeedSource[] = sources.includes("all")
    ? ["yc", "a16z"]
    : (sources as FeedSource[]);

  if (targets.includes("yc")) {
    console.log("[vc-sync] Syncing YC Companies...");
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
  }

  if (targets.includes("a16z")) {
    console.log("[vc-sync] Syncing a16z Portfolio...");
    const a16z = new A16zPortfolioCollector();
    const result = await a16z.save();
    console.log(`[vc-sync] a16z: ${result.count} items -> ${result.outDir}`);
  }

  if (targets.includes("producthunt")) {
    const date = options.phDate || new Date().toISOString().split("T")[0];
    console.log(`[vc-sync] Syncing Product Hunt (${date})...`);
    const ph = new ProductHuntCollector();
    const result = await ph.save(date);
    console.log(
      `[vc-sync] Product Hunt: ${result.count} items -> ${result.outDir}`,
    );
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
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
