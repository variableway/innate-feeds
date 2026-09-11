/**
 * Product Hunt leaderboard collector.
 *
 * Scrapes PH leaderboards in three periods (like GitHub Trending):
 *   - daily:    /leaderboard/daily/{yyyy}/{mm}/{dd}
 *   - weekly:   /leaderboard/weekly/{yyyy}/{ww}  (ISO8601 week)
 *   - monthly:  /leaderboard/monthly/{yyyy}/{mm}
 *
 * Uses Firecrawl JSON extraction (preferred) or HTML fallback.
 *
 * Run:
 *   bunx tsx src/collector/producthunt.ts                          # today daily
 *   bunx tsx src/collector/producthunt.ts --period daily --date 2026-08-25
 *   bunx tsx src/collector/producthunt.ts --period weekly --date 2026-08-25
 *   bunx tsx src/collector/producthunt.ts --period monthly --date 2026-08-01
 *   bunx tsx src/collector/producthunt.ts --period all --save      # daily+weekly+monthly
 *   bunx tsx src/collector/producthunt.ts --save                   # today, all periods
 */

import { saveItems } from "./shared/storage.js";
import { fetchHtml } from "./shared/http.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

export type PHPeriod = "daily" | "weekly" | "monthly";

interface ProductHuntRaw {
  rank: number;
  name: string;
  tagline: string;
  description?: string;
  score?: number;
  comments?: number;
  topics?: string[];
  url?: string;
  externalUrl?: string;
  imageUrl?: string;
}

/** Get ISO8601 week number (1-53) for a date. */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Build the PH leaderboard URL for a given period and date. */
function buildLeaderboardUrl(period: PHPeriod, date: string): string {
  const base = "https://www.producthunt.com/leaderboard";
  const [year, month, day] = date.split("-");

  switch (period) {
    case "daily":
      return `${base}/daily/${year}/${month}/${day}`;
    case "weekly": {
      const d = new Date(date);
      const week = getISOWeek(d);
      return `${base}/weekly/${year}/${week}`;
    }
    case "monthly":
      return `${base}/monthly/${year}/${month}`;
  }
}

/**
 * Derive a label for storage (used as manifest entry label and filename stem).
 *   daily   → "2026-08-25"
 *   weekly  → "2026-W35"
 *   monthly → "2026-08"
 */
function periodLabel(period: PHPeriod, date: string): string {
  const [year, month, day] = date.split("-");
  switch (period) {
    case "daily":
      return date; // "2026-08-25"
    case "weekly": {
      const d = new Date(date);
      const week = getISOWeek(d);
      return `${year}-W${String(week).padStart(2, "0")}`;
    }
    case "monthly":
      return `${year}-${month}`;
  }
}

export class ProductHuntCollector implements FeedCollector {
  source = "producthunt" as const;

  /** Fetch the leaderboard for a specific period and date. */
  async fetchByPeriod(
    period: PHPeriod,
    date: string,
  ): Promise<ExternalFeedItem[]> {
    const url = buildLeaderboardUrl(period, date);
    const label = periodLabel(period, date);
    console.error(`[producthunt] Fetching ${period} → ${url}`);

    try {
      return await this.fetchWithFirecrawl(url, label, period);
    } catch (err) {
      console.warn("[producthunt] Firecrawl failed, using HTML:", err);
      return this.fetchWithHtml(url, label, period);
    }
  }

  /** Fetch daily leaderboard for a date (backward compat). */
  async fetchByDate(date: string): Promise<ExternalFeedItem[]> {
    return this.fetchByPeriod("daily", date);
  }

  /** Fetch today's daily leaderboard. */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const today = new Date().toISOString().split("T")[0];
    return this.fetchByPeriod("daily", today);
  }

  /** Fetch all three periods for a date. */
  async fetchAll(date: string): Promise<ExternalFeedItem[]> {
    const allItems: ExternalFeedItem[] = [];
    for (const period of ["daily", "weekly", "monthly"] as PHPeriod[]) {
      const items = await this.fetchByPeriod(period, date);
      allItems.push(...items);
    }
    return allItems;
  }

  /** Save a single period. */
  async savePeriod(period: PHPeriod, date: string): Promise<SaveResult> {
    const items = await this.fetchByPeriod(period, date);
    const label = periodLabel(period, date);
    return saveItems("producthunt", items, label, `${label}.json`);
  }

  /** Save daily (backward compat). */
  async save(date: string): Promise<SaveResult> {
    return this.savePeriod("daily", date);
  }

  /** Save all three periods for a date. */
  async saveAll(date: string): Promise<SaveResult[]> {
    const results: SaveResult[] = [];
    for (const period of ["daily", "weekly", "monthly"] as PHPeriod[]) {
      const result = await this.savePeriod(period, date);
      results.push(result);
    }
    return results;
  }

  private async fetchWithFirecrawl(
    url: string,
    label: string,
    period: PHPeriod,
  ): Promise<ExternalFeedItem[]> {
    const Firecrawl = (await import("firecrawl")).default;
    const firecrawl = new Firecrawl();
    const result = await firecrawl.scrape(url, {
      formats: [
        {
          type: "json",
          schema: {
            type: "object",
            properties: {
              products: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    rank: { type: "number" },
                    name: { type: "string" },
                    tagline: { type: "string" },
                    description: { type: "string" },
                    score: { type: "number" },
                    comments: { type: "number" },
                    topics: {
                      type: "array",
                      items: { type: "string" },
                    },
                    url: { type: "string" },
                    externalUrl: { type: "string" },
                    imageUrl: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
        },
      ],
      timeout: 60000,
    });

    // @ts-ignore Firecrawl SDK typing gap.
    const data = result.json as { products?: ProductHuntRaw[] };
    if (!data?.products?.length) return [];

    return data.products.map((p) => this.normalize(p, label, period));
  }

  private async fetchWithHtml(
    url: string,
    label: string,
    period: PHPeriod,
  ): Promise<ExternalFeedItem[]> {
    const html = await fetchHtml(url);
    const items: ExternalFeedItem[] = [];

    const namePattern =
      /href="\/products\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match: RegExpExecArray | null;
    let rank = 0;

    const names: { slug: string; name: string }[] = [];
    while ((match = namePattern.exec(html)) !== null) {
      names.push({ slug: match[1], name: match[2].trim() });
    }

    for (const { slug, name } of names) {
      rank++;
      if (rank > 25) break;
      items.push(
        this.normalize(
          {
            rank,
            name,
            tagline: "",
            url: `https://www.producthunt.com/products/${slug}`,
          },
          label,
          period,
        ),
      );
    }

    return items;
  }

  private normalize(
    item: ProductHuntRaw,
    label: string,
    period: PHPeriod,
  ): ExternalFeedItem {
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: `producthunt-${label}-${item.rank}`,
      source: "producthunt",
      title: item.name,
      tagline: item.tagline || "",
      description: item.description || "",
      url: item.url || `https://www.producthunt.com/products/${slug}`,
      externalUrl: item.externalUrl || null,
      imageUrl: item.imageUrl || null,
      categories: item.topics || [],
      metrics: {
        score: item.score,
        comments: item.comments,
      },
      metadata: {
        rank: item.rank,
        period,
        label,
      },
      fetchedAt: new Date().toISOString(),
      publishedAt: label,
    };
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /producthunt\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const args = process.argv.slice(2);
  let date = new Date().toISOString().split("T")[0];
  let period: PHPeriod | "all" = "all";
  let save = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) date = args[++i];
    if (args[i] === "--period" && args[i + 1]) {
      period = args[++i] as PHPeriod | "all";
    }
    if (args[i] === "--save") save = true;
  }

  const collector = new ProductHuntCollector();

  if (save) {
    const run =
      period === "all"
        ? collector.saveAll(date).then((results) => {
            for (const r of results) {
              console.log(
                `Saved ${r.count} items → ${r.outDir} (${r.bytes} bytes)`,
              );
            }
          })
        : collector
            .savePeriod(period, date)
            .then((r) =>
              console.log(
                `Saved ${r.count} items → ${r.outDir} (${r.bytes} bytes)`,
              ),
            );
    run.catch(console.error);
  } else {
    const run =
      period === "all"
        ? collector
            .fetchAll(date)
            .then((items) => console.log(JSON.stringify(items, null, 2)))
        : collector
            .fetchByPeriod(period, date)
            .then((items) => console.log(JSON.stringify(items, null, 2)));
    run.catch(console.error);
  }
}
