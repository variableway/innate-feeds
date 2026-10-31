/**
 * Dev.to collector via the public API (no auth, gzip responses).
 *
 *   - latest: hot articles (`?top=1`)
 *
 * Run:
 *   bun src/collector/devto.ts                 # print hot articles
 *   bun src/collector/devto.ts --save
 */

import { saveItems } from "./shared/storage.js";
import { fetchJson } from "./shared/http.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

const API_BASE = "https://dev.to/api/articles";

interface DevToArticle {
  id: number;
  title: string;
  description: string | null;
  url: string;
  cover_image: string | null;
  positive_reactions_count: number | null;
  comments_count: number | null;
  published_at: string | null;
  reading_time_minutes: number | null;
  tag_list?: string[];
  user?: { username?: string; name?: string; profile_image?: string };
}

export function normalizeDevToArticle(article: DevToArticle): ExternalFeedItem {
  return {
    id: `devto-${article.id}`,
    source: "devto",
    title: article.title,
    tagline: article.description || "",
    description: article.description || "",
    url: article.url,
    externalUrl: article.url,
    imageUrl: article.cover_image || article.user?.profile_image || null,
    categories: article.tag_list ?? [],
    metrics: {
      score: article.positive_reactions_count ?? undefined,
      comments: article.comments_count ?? undefined,
    },
    metadata: {
      author: article.user?.username,
      authorName: article.user?.name,
      readingTimeMinutes: article.reading_time_minutes ?? undefined,
    },
    fetchedAt: new Date().toISOString(),
    publishedAt: article.published_at || null,
  };
}

export class DevToCollector implements FeedCollector {
  source = "devto" as const;
  private limit: number;

  constructor(options?: { limit?: number }) {
    this.limit = options?.limit ?? 50;
  }

  /** Hot articles (Dev.to "top" feed, ~last 7 days by reactions). */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const url = `${API_BASE}?top=1&per_page=${this.limit}`;
    console.error(`[devto] Fetching hot articles`);
    const data = await fetchJson<DevToArticle[]>(url);
    return (Array.isArray(data) ? data : []).map(normalizeDevToArticle);
  }

  /** Save today's snapshot. */
  async save(): Promise<SaveResult> {
    const label = new Date().toISOString().split("T")[0];
    const items = await this.fetchLatest();
    return saveItems("devto", items, label, `${label}.json`);
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /devto\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const save = process.argv.includes("--save");
  const collector = new DevToCollector();
  const run = save
    ? collector
        .save()
        .then((r) =>
          console.log(
            `Saved ${r.count} items → ${r.outDir} (${r.bytes} bytes)`,
          ),
        )
    : collector
        .fetchLatest()
        .then((items) => console.log(JSON.stringify(items, null, 2)));
  run.catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
