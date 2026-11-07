/**
 * External feed source contract (S0, GH #31).
 * 单一真相：后端（产出方）与前端（消费方）共同 re-export，禁止各自再抄。
 * 边界：纯类型，无 IO / React / 运行时 API。
 */

/** 数据源标识 */
export type FeedSource =
  | "producthunt"
  | "yc"
  | "a16z"
  | "github-topics"
  | "trendshift"
  | "awesome-dsh"
  | "hackernews"
  | "huggingface"
  | "github-new"
  | "devto"
  | "lobsters"
  | "edu-skills"
  | "edu-videos"
  | "edu-videos-bilibili";

/** 统一外部 Feed Item 接口 */
export interface ExternalFeedItem {
  /** 唯一 ID，格式: `{source}-{slug|id}` */
  id: string;
  /** 数据源 */
  source: FeedSource;
  /** 产品/公司名称 */
  title: string;
  /** 一句话描述 */
  tagline: string;
  /** 详细描述 */
  description: string;
  /** 原始链接（PH 产品页 / YC 公司页） */
  url: string;
  /** 产品官网 */
  externalUrl: string | null;
  /** 图标/logo URL */
  imageUrl: string | null;
  /** 分类标签 */
  categories: string[];
  /** 量化指标 */
  metrics: FeedItemMetrics;
  /** 源特定扩展数据 */
  metadata: Record<string, unknown>;
  /** 数据采集时间 */
  fetchedAt: string;
  /** 发布/上线日期 */
  publishedAt: string | null;
}

/** 量化指标 — 各源按需填充 */
export interface FeedItemMetrics {
  /** Product Hunt 社区分数 / HN points / Dev.to reactions / Lobsters score / HF likes */
  score?: number;
  /** 评论数（PH / HN / Dev.to / Lobsters） */
  comments?: number;
  /** GitHub Stars */
  stars?: number;
  /** Hugging Face 30d downloads */
  downloads?: number;
  /** GitHub forks */
  forks?: number;
  /** 团队规模 */
  teamSize?: number;
  /** YC Batch (e.g. "P26") */
  batch?: string;
  /** 公司状态 */
  status?: string;
}

/** /api/external 索引里的单个源条目 */
export interface ExternalSourceEntry {
  source: FeedSource;
  title: string;
  description: string;
  homepage: string;
  count: number;
  label: string | null;
  fetchedAt: string | null;
  snapshots: number;
  /** 静态模式：源是否已有本地快照（前端派生标记） */
  synced?: boolean;
}

/** /api/external 索引响应 */
export interface ExternalIndex {
  updatedAt: string | null;
  sources: ExternalSourceEntry[];
}

/** /api/external/:source 响应 */
export interface ExternalSourcePayload {
  source: FeedSource;
  title: string;
  description: string;
  label: string;
  fetchedAt: string;
  count: number;
  items: ExternalFeedItem[];
}
