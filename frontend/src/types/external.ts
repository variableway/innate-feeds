/**
 * External feed source types (GH #31).
 * Mirrors backend `collector/shared/types.ts` ExternalFeedItem + the
 * `/api/external*` payloads (static mode reads the same shape from
 * `/data/external/*.json`).
 */

export type ExternalSourceId =
  | "producthunt"
  | "yc"
  | "a16z"
  | "hackernews"
  | "huggingface"
  | "github-new"
  | "devto"
  | "lobsters";

export interface ExternalFeedItem {
  id: string;
  source: ExternalSourceId;
  title: string;
  tagline: string;
  description: string;
  url: string;
  externalUrl: string | null;
  imageUrl: string | null;
  categories: string[];
  metrics: {
    score?: number;
    comments?: number;
    stars?: number;
    downloads?: number;
    forks?: number;
    teamSize?: number;
    batch?: string;
    status?: string;
  };
  metadata: Record<string, unknown>;
  fetchedAt: string;
  publishedAt: string | null;
}

export interface ExternalSourceEntry {
  source: ExternalSourceId;
  title: string;
  description: string;
  homepage: string;
  count: number;
  label: string | null;
  fetchedAt: string | null;
  snapshots?: number;
  synced?: boolean;
}

export interface ExternalIndex {
  updatedAt: string | null;
  sources: ExternalSourceEntry[];
}

export interface ExternalSourcePayload {
  source: ExternalSourceId;
  title: string;
  description: string;
  label: string;
  fetchedAt: string;
  count: number;
  items: ExternalFeedItem[];
}

/** Which metric chips to render per source (label + item field). */
export interface SourceMetricConfig {
  key:
    | "score"
    | "comments"
    | "stars"
    | "downloads"
    | "forks"
    | "teamSize"
    | "batch"
    | "status";
  label: string;
}

export interface ExternalSourceMeta {
  source: ExternalSourceId;
  title: string;
  description: string;
  homepage: string;
  icon: string;
  /** lucide icon name used by the sidebar; page header falls back to this too */
  metrics: SourceMetricConfig[];
  /** Field shown as the item's secondary line, when tagline is empty. */
  emptyHint: string;
}

/** Sidebar/page metadata for the Feeds group. Order = display order. */
export const EXTERNAL_SOURCE_META: ExternalSourceMeta[] = [
  {
    source: "hackernews",
    title: "Hacker News",
    description: "HN 首页热帖（Algolia API）",
    homepage: "https://news.ycombinator.com",
    icon: "Flame",
    metrics: [
      { key: "score", label: "points" },
      { key: "comments", label: "comments" },
    ],
    emptyHint: "Run `bun run sync:hackernews` to collect the front page.",
  },
  {
    source: "huggingface",
    title: "Hugging Face",
    description: "HF Trending 模型/数据集/Spaces",
    homepage: "https://huggingface.co",
    icon: "Boxes",
    metrics: [
      { key: "score", label: "likes" },
      { key: "downloads", label: "downloads" },
    ],
    emptyHint: "Run `bun run sync:huggingface` to collect trending repos.",
  },
  {
    source: "github-new",
    title: "GitHub New",
    description: "近 7 天新建且快速增长的开源仓库",
    homepage: "https://github.com/search",
    icon: "Sparkles",
    metrics: [
      { key: "stars", label: "stars" },
      { key: "forks", label: "forks" },
    ],
    emptyHint:
      "Run `bun run sync:github-new` to collect fast-growing new repos.",
  },
  {
    source: "devto",
    title: "Dev.to",
    description: "Dev.to 热门技术文章",
    homepage: "https://dev.to",
    icon: "FileText",
    metrics: [
      { key: "score", label: "reactions" },
      { key: "comments", label: "comments" },
    ],
    emptyHint: "Run `bun run sync:devto` to collect hot articles.",
  },
  {
    source: "lobsters",
    title: "lobste.rs",
    description: "Lobsters 最热讨论",
    homepage: "https://lobste.rs",
    icon: "Link2",
    metrics: [
      { key: "score", label: "score" },
      { key: "comments", label: "comments" },
    ],
    emptyHint: "Run `bun run sync:lobsters` to collect the hottest stories.",
  },
  {
    source: "producthunt",
    title: "Product Hunt",
    description: "每日/周/月新品榜",
    homepage: "https://www.producthunt.com/leaderboard",
    icon: "Rocket",
    metrics: [
      { key: "score", label: "votes" },
      { key: "comments", label: "comments" },
    ],
    emptyHint: "Run `bun run sync:producthunt` to collect the leaderboard.",
  },
  {
    source: "yc",
    title: "YC Companies",
    description: "Y Combinator 公司库（按 batch）",
    homepage: "https://www.ycombinator.com/companies",
    icon: "Building2",
    metrics: [
      { key: "batch", label: "batch" },
      { key: "teamSize", label: "team" },
    ],
    emptyHint: "Run `bun run sync:yc` to collect YC companies.",
  },
  {
    source: "a16z",
    title: "a16z Portfolio",
    description: "a16z AI 投资组合 + GitHub 补充",
    homepage: "https://a16z.com/ai/",
    icon: "Briefcase",
    metrics: [
      { key: "stars", label: "stars" },
      { key: "status", label: "status" },
    ],
    emptyHint: "Run `bun run sync:a16z` to collect the portfolio.",
  },
];
