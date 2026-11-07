/**
 * Collector-shared types.
 * 跨层契约已收敛至根 shared/（S0）：本文件只保留采集层自有接口，
 * ExternalFeedItem / FeedSource / FeedItemMetrics re-export 自 shared/types/external。
 */
import type {
  ExternalFeedItem,
  FeedSource,
} from "../../../../shared/types/external.js";

export type {
  FeedSource,
  ExternalFeedItem,
  FeedItemMetrics,
  ExternalSourceEntry,
  ExternalIndex,
  ExternalSourcePayload,
} from "../../../../shared/types/external.js";

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
