/**
 * lobste.rs collector via the public hottest.json feed (no auth).
 *
 * Run:
 *   bun src/collector/lobsters.ts                 # print hottest stories
 *   bun src/collector/lobsters.ts --save
 */

import { saveItems } from "./shared/storage.js";
import { fetchJson } from "./shared/http.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

const API_URL = "https://lobste.rs/hottest.json";

interface LobsterStory {
  short_id: string;
  title: string;
  url: string | null;
  score: number | null;
  comment_count: number | null;
  created_at: string | null;
  description: string | null;
  tags: string[];
  submitter_user?: { username: string };
}

export function normalizeLobster(story: LobsterStory): ExternalFeedItem {
  const commentsUrl = `https://lobste.rs/s/${story.short_id}`;
  return {
    id: `lobsters-${story.short_id}`,
    source: "lobsters",
    title: story.title,
    tagline: story.description || "",
    description: story.description || "",
    url: commentsUrl,
    externalUrl: story.url || null,
    imageUrl: null,
    categories: story.tags ?? [],
    metrics: {
      score: story.score ?? undefined,
      comments: story.comment_count ?? undefined,
    },
    metadata: {
      shortId: story.short_id,
      submitter: story.submitter_user?.username,
    },
    fetchedAt: new Date().toISOString(),
    publishedAt: story.created_at || null,
  };
}

export class LobstersCollector implements FeedCollector {
  source = "lobsters" as const;

  /** Current hottest stories. */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    console.error(`[lobsters] Fetching hottest`);
    const data = await fetchJson<LobsterStory[]>(API_URL);
    return (Array.isArray(data) ? data : []).map(normalizeLobster);
  }

  /** Save today's snapshot. */
  async save(): Promise<SaveResult> {
    const label = new Date().toISOString().split("T")[0];
    const items = await this.fetchLatest();
    return saveItems("lobsters", items, label, `${label}.json`);
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /lobsters\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const save = process.argv.includes("--save");
  const collector = new LobstersCollector();
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
