/**
 * External feed source types (GH #31).
 * S0：wire 契约（ExternalFeedItem / FeedSource / …）收敛至根 shared/，此处 re-export；
 * 本文件只保留 UI 覆盖层（icon / metrics / emptyHint，S4）与 joined 视图。
 */

import type { FeedSource } from "../../../shared/types/external";
import { EXTERNAL_SOURCES } from "../../../shared/sources/external";

export type {
  FeedSource,
  ExternalFeedItem,
  FeedItemMetrics,
  ExternalSourceEntry,
  ExternalIndex,
  ExternalSourcePayload,
} from "../../../shared/types/external";

/** 漂移修复 #1（S0）：ExternalSourceId 不再独立维护，从 shared FeedSource 派生。 */
export type ExternalSourceId = FeedSource;

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

/** UI 覆盖层（S4）：只放表现层关注点，数据字段（title/description/homepage）在 shared。 */
export interface ExternalSourceMeta {
  source: ExternalSourceId;
  icon: string;
  /** lucide icon name used by the sidebar; page header falls back to this too */
  metrics: SourceMetricConfig[];
  /** Field shown as the item's secondary line, when tagline is empty. */
  emptyHint: string;
}

/** UI 覆盖层，顺序 = 展示顺序。 */
export const EXTERNAL_SOURCE_META: ExternalSourceMeta[] = [
  {
    source: "hackernews",
    icon: "Flame",
    metrics: [
      { key: "score", label: "points" },
      { key: "comments", label: "comments" },
    ],
    emptyHint: "Run `bun run sync:hackernews` to collect the front page.",
  },
  {
    source: "huggingface",
    icon: "Boxes",
    metrics: [
      { key: "score", label: "likes" },
      { key: "downloads", label: "downloads" },
    ],
    emptyHint: "Run `bun run sync:huggingface` to collect trending repos.",
  },
  {
    source: "github-new",
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
    icon: "FileText",
    metrics: [
      { key: "score", label: "reactions" },
      { key: "comments", label: "comments" },
    ],
    emptyHint: "Run `bun run sync:devto` to collect hot articles.",
  },
  {
    source: "lobsters",
    icon: "Link2",
    metrics: [
      { key: "score", label: "score" },
      { key: "comments", label: "comments" },
    ],
    emptyHint: "Run `bun run sync:lobsters` to collect the hottest stories.",
  },
  {
    source: "producthunt",
    icon: "Rocket",
    metrics: [
      { key: "score", label: "votes" },
      { key: "comments", label: "comments" },
    ],
    emptyHint: "Run `bun run sync:producthunt` to collect the leaderboard.",
  },
  {
    source: "yc",
    icon: "Building2",
    metrics: [
      { key: "batch", label: "batch" },
      { key: "teamSize", label: "team" },
    ],
    emptyHint: "Run `bun run sync:yc` to collect YC companies.",
  },
  {
    source: "a16z",
    icon: "Briefcase",
    metrics: [
      { key: "stars", label: "stars" },
      { key: "status", label: "status" },
    ],
    emptyHint: "Run `bun run sync:a16z` to collect the portfolio.",
  },
  {
    source: "edu-skills",
    icon: "GraduationCap",
    metrics: [
      { key: "score", label: "installs" },
      { key: "stars", label: "stars" },
    ],
    emptyHint: "Run `bun run sync:edu-skills` to collect the skill catalog.",
  },
  {
    source: "edu-videos",
    icon: "Clapperboard",
    metrics: [
      { key: "score", label: "views" },
      { key: "comments", label: "likes" },
    ],
    emptyHint: "Run `bun run sync:edu-videos` to collect the channel videos.",
  },
  {
    source: "edu-videos-bilibili",
    icon: "Tv",
    metrics: [{ key: "score", label: "播放" }],
    emptyHint:
      "Run `bun run sync:edu-videos-bilibili` to collect bilibili videos.",
  },
];

/** joined 视图（S4）：shared 数据 + UI 覆盖层，顺序跟随 UI 覆盖层。 */
export interface ExternalSourceView {
  source: ExternalSourceId;
  title: string;
  description: string;
  homepage: string;
  icon: string;
  metrics: SourceMetricConfig[];
  emptyHint: string;
}

export const EXTERNAL_SOURCE_VIEWS: ExternalSourceView[] =
  EXTERNAL_SOURCE_META.map((ui) => {
    const def = EXTERNAL_SOURCES.find((s) => s.source === ui.source);
    return {
      source: ui.source,
      title: def?.title ?? ui.source,
      description: def?.description ?? "",
      homepage: def?.homepage ?? "",
      icon: ui.icon,
      metrics: ui.metrics,
      emptyHint: ui.emptyHint,
    };
  });
