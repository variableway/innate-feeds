/**
 * Hacker News collector via the public Algolia API (no auth).
 *
 *   - latest: front page stories (`tags=front_page`)
 *   - byDate: stories created that day, top by points
 *
 * Run:
 *   bun src/collector/hackernews.ts                       # print front page
 *   bun src/collector/hackernews.ts --save                # save front page
 *   bun src/collector/hackernews.ts --date 2026-10-31 --save
 */

import { saveItems } from "./shared/storage.js";
import { fetchJson } from "./shared/http.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

const API_BASE = "https://hn.algolia.com/api/v1";

interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  points: number | null;
  num_comments: number | null;
  created_at: string | null;
  story_text?: string | null;
  _tags?: string[];
}

interface HNSearchResponse {
  hits: HNHit[];
  nbHits?: number;
}

/** Strip HN's escaped HTML in story_text down to plain text. */
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHNHit(hit: HNHit): ExternalFeedItem {
  const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
  const tagline = hit.story_text ? stripHtml(hit.story_text).slice(0, 200) : "";
  return {
    id: `hackernews-${hit.objectID}`,
    source: "hackernews",
    title: hit.title || hnUrl,
    tagline,
    description: "",
    url: hnUrl,
    externalUrl: hit.url || null,
    imageUrl: null,
    categories: [],
    metrics: {
      score: hit.points ?? undefined,
      comments: hit.num_comments ?? undefined,
    },
    metadata: {
      author: hit.author,
      storyId: hit.objectID,
    },
    fetchedAt: new Date().toISOString(),
    publishedAt: hit.created_at || null,
  };
}

export class HackerNewsCollector implements FeedCollector {
  source = "hackernews" as const;
  private limit: number;

  constructor(options?: { limit?: number }) {
    this.limit = options?.limit ?? 50;
  }

  /** Current front page. */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const url = `${API_BASE}/search?tags=front_page&hitsPerPage=${this.limit}`;
    console.error(`[hackernews] Fetching front page`);
    const data = await fetchJson<HNSearchResponse>(url);
    return (data.hits ?? []).map(normalizeHNHit);
  }

  /** Top stories created on a date (UTC), sorted by points desc. */
  async fetchByDate(date: string): Promise<ExternalFeedItem[]> {
    const start = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
    const end = start + 86400;
    const url =
      `${API_BASE}/search?tags=story` +
      `&numericFilters=created_at_i>${start},created_at_i<${end},points>20` +
      `&hitsPerPage=100`;
    console.error(`[hackernews] Fetching top of ${date}`);
    const data = await fetchJson<HNSearchResponse>(url);
    return (data.hits ?? [])
      .map(normalizeHNHit)
      .sort((a, b) => (b.metrics.score ?? 0) - (a.metrics.score ?? 0))
      .slice(0, this.limit);
  }

  /** Save the latest snapshot (front page today / top of a date). */
  async save(date?: string): Promise<SaveResult> {
    const label = date || new Date().toISOString().split("T")[0];
    const items = date
      ? await this.fetchByDate(date)
      : await this.fetchLatest();
    return saveItems("hackernews", items, label, `${label}.json`);
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /hackernews\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const args = process.argv.slice(2);
  let date: string | undefined;
  let save = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) date = args[++i];
    if (args[i] === "--save") save = true;
  }

  const collector = new HackerNewsCollector();
  const run = save
    ? collector
        .save(date)
        .then((r) =>
          console.log(
            `Saved ${r.count} items → ${r.outDir} (${r.bytes} bytes)`,
          ),
        )
    : (date ? collector.fetchByDate(date) : collector.fetchLatest()).then(
        (items) => console.log(JSON.stringify(items, null, 2)),
      );
  run.catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
