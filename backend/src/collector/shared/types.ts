/** 数据源标识 */
export type FeedSource = "producthunt" | "yc" | "a16z" | "github-topics";

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
  /** Product Hunt 社区分数 */
  score?: number;
  /** Product Hunt 评论数 */
  comments?: number;
  /** GitHub Stars */
  stars?: number;
  /** 团队规模 */
  teamSize?: number;
  /** YC Batch (e.g. "P26") */
  batch?: string;
  /** 公司状态 */
  status?: string;
}

/** 采集器接口 */
export interface FeedCollector {
  source: FeedSource;
  fetchLatest(): Promise<ExternalFeedItem[]>;
  fetchByDate?(date: string): Promise<ExternalFeedItem[]>;
}

/** 存储结果 */
export interface SaveResult {
  source: FeedSource;
  outDir: string;
  files: string[];
  count: number;
  bytes: number;
}
