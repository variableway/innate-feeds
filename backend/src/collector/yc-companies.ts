/**
 * Y Combinator Companies API collector.
 *
 * Fetches from https://api.ycombinator.com/v0.1/companies (public, no auth).
 * Supports filtering by batch and search query.
 *
 * Run:
 *   bunx tsx src/collector/yc-companies.ts                     # all default batches
 *   bunx tsx src/collector/yc-companies.ts --batch P26         # single batch
 *   bunx tsx src/collector/yc-companies.ts --save              # save to ~/.innate/yc/
 *   bunx tsx src/collector/yc-companies.ts --query "open source" --save
 */

import { fetchJson } from "./shared/http.js";
import { saveItems } from "./shared/storage.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

interface YCCompany {
  id: number;
  name: string;
  slug: string;
  website: string;
  smallLogoUrl: string | null;
  oneLiner: string;
  longDescription: string;
  teamSize: number;
  url: string;
  batch: string;
  tags: string[];
  status: string;
  industries: string[];
  regions: string[];
  locations: string[];
  badges: string[];
}

interface YCApiResponse {
  companies: YCCompany[];
  nextPage: string | null;
  page: number;
  totalPages: number;
}

const DEFAULT_BATCHES = [
  "W24",
  "S24",
  "F25",
  "W25",
  "X25",
  "P26",
];

export class YCCompaniesCollector implements FeedCollector {
  source = "yc" as const;

  private batches: string[];
  private query: string;

  constructor(options?: { batches?: string[]; query?: string }) {
    this.batches = options?.batches || DEFAULT_BATCHES;
    this.query = options?.query || "ai";
  }

  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const allItems: ExternalFeedItem[] = [];

    for (const batch of this.batches) {
      const items = await this.fetchBatch(batch);
      allItems.push(...items);
    }

    const deduped = [...new Map(allItems.map((i) => [i.id, i])).values()];
    console.error(
      `[yc] Fetched ${deduped.length} companies across ${this.batches.length} batches`,
    );
    return deduped;
  }

  async fetchBatch(batch: string): Promise<ExternalFeedItem[]> {
    const items: ExternalFeedItem[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const params = new URLSearchParams({ page: String(page) });
      if (this.query) params.set("q", this.query);
      for (const b of batch.split(",")) {
        params.append("batch", b.trim());
      }

      const url = `https://api.ycombinator.com/v0.1/companies?${params}`;
      console.error(`[yc] GET ${url}`);

      const data = await fetchJson<YCApiResponse>(url);
      totalPages = data.totalPages;

      for (const company of data.companies) {
        items.push(this.normalize(company));
      }

      page++;
    }

    return items;
  }

  async save(): Promise<SaveResult[]> {
    const results: SaveResult[] = [];
    for (const batch of this.batches) {
      const items = await this.fetchBatch(batch);
      const result = saveItems("yc", items, batch, `batch-${batch}.json`);
      results.push(result);
    }
    return results;
  }

  private normalize(company: YCCompany): ExternalFeedItem {
    return {
      id: `yc-${company.id}`,
      source: "yc",
      title: company.name,
      tagline: company.oneLiner || "",
      description: company.longDescription || "",
      url: company.url,
      externalUrl: company.website || null,
      imageUrl: company.smallLogoUrl || null,
      categories: [...(company.industries || []), ...(company.tags || [])],
      metrics: {
        teamSize: company.teamSize,
        batch: company.batch,
        status: company.status,
      },
      metadata: {
        ycompanyId: company.id,
        slug: company.slug,
        batch: company.batch,
        industries: company.industries,
        regions: company.regions,
        locations: company.locations,
        badges: company.badges,
        tags: company.tags,
      },
      fetchedAt: new Date().toISOString(),
      publishedAt: null,
    };
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /yc-companies\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const args = process.argv.slice(2);
  let batches: string[] | undefined;
  let query = "ai";
  let save = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--batch" && args[i + 1]) {
      batches = batches || [];
      batches.push(args[++i]);
    }
    if (args[i] === "--query" && args[i + 1]) query = args[++i];
    if (args[i] === "--save") save = true;
  }

  const collector = new YCCompaniesCollector({ batches, query });
  if (save) {
    collector
      .save()
      .then((results) => {
        for (const r of results) {
          console.log(
            `Saved ${r.count} items for batch to ${r.outDir} (${r.bytes} bytes)`,
          );
        }
      })
      .catch(console.error);
  } else {
    collector
      .fetchLatest()
      .then((items) => console.log(JSON.stringify(items, null, 2)))
      .catch(console.error);
  }
}
