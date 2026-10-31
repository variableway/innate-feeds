/**
 * Hugging Face trending collector via the public Hub API (no auth).
 *
 *   - primary: GET /api/trending  → { recentlyTrending: [{repoData, repoType, id}] }
 *   - fallback: GET /api/models?sort=trendingScore&direction=-1 (models only)
 *
 * Note: huggingface.co is unreachable from some networks (e.g. mainland China);
 * the fallback only triggers on API errors, not on network blocks. CI runners
 * reach both endpoints fine.
 *
 * Run:
 *   bun src/collector/huggingface.ts                 # print trending
 *   bun src/collector/huggingface.ts --save
 */

import { saveItems } from "./shared/storage.js";
import { fetchJson } from "./shared/http.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

const API_BASE = "https://huggingface.co/api";

interface HFRepoData {
  id?: string;
  modelId?: string;
  author?: string;
  likes?: number;
  downloads?: number;
  pipeline_tag?: string;
  library_name?: string;
  lastModified?: string;
  createdAt?: string;
  tags?: string[];
  cardData?: { language?: string[]; license?: string; tags?: string[] };
}

interface HFTrendingEntry {
  id?: string;
  repoType?: string; // "model" | "dataset" | "space"
  repoData?: HFRepoData;
  createdAt?: string;
}

interface HFTrendingResponse {
  recentlyTrending?: HFTrendingEntry[];
  // some deployments return a bare array
  [k: string]: unknown;
}

/** Hub URL for a repo: models live at /{id}, datasets/spaces under their prefix. */
function hubUrl(repoType: string, id: string): string {
  if (repoType === "model") return `https://huggingface.co/${id}`;
  return `https://huggingface.co/${repoType}s/${id}`;
}

export function normalizeHFEntry(
  entry: HFTrendingEntry,
): ExternalFeedItem | null {
  const repoType = entry.repoType || "model";
  const data = entry.repoData ?? (entry as unknown as HFRepoData);
  const id = entry.id || data.id || data.modelId;
  if (!id) return null;
  const likes = data.likes ?? undefined;

  return {
    id: `huggingface-${repoType}-${id.replace(/[^a-zA-Z0-9._/-]+/g, "-")}`,
    source: "huggingface",
    title: id,
    tagline: data.pipeline_tag || repoType,
    description: data.pipeline_tag || "",
    url: hubUrl(repoType, id),
    externalUrl: hubUrl(repoType, id),
    imageUrl: null,
    categories: [
      repoType,
      ...(data.pipeline_tag ? [data.pipeline_tag] : []),
      ...(data.library_name ? [data.library_name] : []),
    ],
    metrics: {
      score: likes,
      downloads: data.downloads ?? undefined,
    },
    metadata: {
      repoType,
      author: data.author ?? id.split("/")[0],
      pipelineTag: data.pipeline_tag,
      library: data.library_name,
      lastModified: data.lastModified,
    },
    fetchedAt: new Date().toISOString(),
    publishedAt: entry.createdAt || data.createdAt || null,
  };
}

export class HuggingFaceCollector implements FeedCollector {
  source = "huggingface" as const;
  private limit: number;

  constructor(options?: { limit?: number }) {
    this.limit = options?.limit ?? 50;
  }

  /** Trending models + datasets + spaces. */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    console.error(`[huggingface] Fetching trending`);
    try {
      const data = await fetchJson<HFTrendingResponse>(`${API_BASE}/trending`);
      const entries: HFTrendingEntry[] = Array.isArray(data)
        ? (data as unknown as HFTrendingEntry[])
        : (data.recentlyTrending ?? []);
      const items = entries
        .map(normalizeHFEntry)
        .filter((i): i is ExternalFeedItem => i !== null);
      if (items.length) return items.slice(0, this.limit);
      console.warn("[huggingface] /api/trending empty, falling back to models");
    } catch (err) {
      console.warn(
        "[huggingface] /api/trending failed, falling back to models:",
        err instanceof Error ? err.message : err,
      );
    }
    return this.fetchModelsFallback();
  }

  /** Fallback: top trending models by trendingScore. */
  private async fetchModelsFallback(): Promise<ExternalFeedItem[]> {
    const data = await fetchJson<HFTrendingEntry[]>(
      `${API_BASE}/models?sort=trendingScore&direction=-1&limit=${this.limit}`,
    );
    return (Array.isArray(data) ? data : [])
      .map((m) =>
        normalizeHFEntry({
          repoType: "model",
          repoData: m,
          id: (m as HFRepoData).id,
        }),
      )
      .filter((i): i is ExternalFeedItem => i !== null);
  }

  /** Save today's snapshot. */
  async save(): Promise<SaveResult> {
    const label = new Date().toISOString().split("T")[0];
    const items = await this.fetchLatest();
    return saveItems("huggingface", items, label, `${label}.json`);
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /huggingface\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const save = process.argv.includes("--save");
  const collector = new HuggingFaceCollector();
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
