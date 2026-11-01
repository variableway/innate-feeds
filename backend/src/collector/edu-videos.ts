/**
 * edu-videos —— 教育动画领域的教学视频采集器。
 *
 * 只收元数据与链接，不下载、不转存视频本体。
 *
 * ## 为什么用 handle 而不是写死 channel id
 *
 * YouTube 的 channel id 是 24 位随机串，写死在代码里既没法肉眼核对，
 * 写错了还会静默指向别的频道。这里策展清单存**可读的 handle**（如 @3blue1brown），
 * 采集时用 `channels.list?part=id&forHandle=@handle`（1 单位）解析成 id。
 * handle 写错 → 解析不到 → 该 feed 记一条警告并跳过，不会产生错误数据。
 *
 * ## 成本
 *
 * YouTube Data API v3 的单位成本相差 100 倍：
 *   search.list         = 100 单位   ← 关键词搜索，最贵，且 2026-06-01 起每天限 100 次
 *   playlistItems.list  =   1 单位   ← 列一个播放列表/频道的条目
 *   videos.list         =   1 单位   ← 批量取详情（一次最多 50 个 id）
 *   channels.list       =   1 单位
 * 默认配额 10,000 单位/天（太平洋时间零点重置）。本采集器全程走 1 单位档，
 * 8 个频道约 16 单位/轮，稳在免费配额内。
 *
 * ## 前置条件
 *
 * 需要 `YOUTUBE_API_KEY`（Google Cloud → 启用 YouTube Data API v3 → 建 API key）。
 * 没有 key 时 channels.list 不可用 → 无法把 handle 解析成 id → 整体不可采集。
 *
 * ⚠️ 本机（cn 区）直连 youtube.com / googleapis.com 均超时，
 *    该采集器需在 CI（ubuntu-latest）里跑；本机只能验证解析逻辑（见 edu-videos.test.ts）。
 */

import { fetchJson, fetchHtml } from "./shared/http.js";
import { saveItems } from "./shared/storage.js";
import { matchEduCategories } from "../../../shared/edu-categories.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

/** 策展的频道。分类由策展者指定，不靠关键词猜。 */
export interface EduVideoFeed {
  /** 稳定的来源 id */
  id: string;
  /** 展示名 */
  title: string;
  /** YouTube handle（不含 @ 会在解析时补上） */
  handle: string;
  /** 策展分类 id，对应 shared/edu-categories.ts */
  category: string;
  /** 该来源在站点上的说明 */
  note?: string;
}

/**
 * 策展清单 —— 覆盖「数学/科学可视化」「动画制作工具」「教学视频创作」三条线。
 * handle 为公开值；若某频道改名或停更，采集会解析失败并跳过（见 collectFeed）。
 */
export const EDU_VIDEO_FEEDS: EduVideoFeed[] = [
  {
    id: "3b1b",
    title: "3Blue1Brown",
    handle: "@3blue1brown",
    category: "explainer",
    note: "数学可视化动画的标杆；Manim 生态的源头。",
  },
  {
    id: "ted-ed",
    title: "TED-Ed",
    handle: "@TEDEd",
    category: "explainer",
    note: "科普解说动画合集，教学脚本结构值得学。",
  },
  {
    id: "kurzgesagt",
    title: "Kurzgesagt",
    handle: "@kurzgesagt",
    category: "explainer",
    note: "二维科普动画的工业级样本。",
  },
  {
    id: "veritasium",
    title: "Veritasium",
    handle: "@veritasium",
    category: "explainer",
    note: "科学解说，动画与实拍结合。",
  },
  {
    id: "animation-insider",
    title: "Animation Insider",
    handle: "@AnimationInsider",
    category: "animation-tools",
    note: "动画制作流程与工具评测。",
  },
  {
    id: "school-of-motion",
    title: "School of Motion",
    handle: "@SchoolOfMotion",
    category: "motion-design",
    note: "After Effects 动效课程。",
  },
  {
    id: "remotion",
    title: "Remotion",
    handle: "@remotion",
    category: "animation-tools",
    note: "用 React 写视频；教育动画制作的主流工具之一。",
  },
  {
    id: "manim-community",
    title: "Manim Community",
    handle: "@ManimCommunity",
    category: "explainer",
    note: "数学动画引擎 Manim 的社区频道。",
  },
];

const API_BASE = "https://www.googleapis.com/youtube/v3";
const RSS_BASE = "https://www.youtube.com/feeds/videos.xml";

interface YoutubeListItem {
  contentDetails?: { videoId?: string };
}

interface YoutubeListResponse {
  items?: YoutubeListItem[];
  nextPageToken?: string;
}

interface YoutubeVideoItem {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    tags?: string[];
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string };
}

/** ISO 8601 时长（PT4M13S）→ 秒。 */
export function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** RSS 条目。 */
export interface RssEntry {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string | null;
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** 解析 YouTube 频道 / 播放列表 RSS。 */
export function parseRssFeed(xml: string): RssEntry[] {
  const out: RssEntry[] = [];
  const entries = xml.split("<entry>").slice(1);
  for (const raw of entries) {
    const videoId = raw.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!videoId) continue;
    const published = raw.match(/<published>([^<]+)<\/published>/)?.[1];
    const t = published ? Date.parse(published) : NaN;
    out.push({
      videoId,
      title: decodeXml(raw.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
      description: decodeXml(
        raw.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ??
          "",
      ),
      channelTitle: decodeXml(
        raw.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1] ?? "",
      ),
      publishedAt: Number.isNaN(t) ? null : new Date(t).toISOString(),
    });
  }
  return out;
}

/** handle → channel id。 */
export async function resolveChannelId(
  handle: string,
  apiKey: string,
): Promise<string | null> {
  const normalized = handle.startsWith("@") ? handle : `@${handle}`;
  const params = new URLSearchParams({
    part: "id,snippet",
    forHandle: normalized,
    key: apiKey,
  });
  const data = await fetchJson<{
    items?: { id?: string; snippet?: { title?: string } }[];
  }>(`${API_BASE}/channels?${params}`, { timeout: 30000 });
  const first = data.items?.[0];
  return first?.id ?? null;
}

/** 拉频道 uploads 播放列表的条目（每条 1 单位）。 */
async function fetchPlaylistItems(
  playlistId: string,
  apiKey: string,
  maxItems = 25,
): Promise<YoutubeListItem[]> {
  const items: YoutubeListItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: String(Math.min(50, maxItems - items.length)),
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await fetchJson<YoutubeListResponse>(
      `${API_BASE}/playlistItems?${params}`,
      { timeout: 30000 },
    );
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && items.length < maxItems);
  return items;
}

/** 批量取视频详情（每 50 个 id 一批，每批 1 单位）。 */
async function fetchVideoStats(
  ids: string[],
  apiKey: string,
): Promise<YoutubeVideoItem[]> {
  if (!ids.length) return [];
  const out: YoutubeVideoItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: chunk.join(","),
      key: apiKey,
    });
    const data = await fetchJson<{ items?: YoutubeVideoItem[] }>(
      `${API_BASE}/videos?${params}`,
      { timeout: 30000 },
    );
    out.push(...(data.items ?? []));
  }
  return out;
}

export interface CollectedVideo {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string | null;
  duration: number | null;
  views: number | null;
  likes: number | null;
}

/**
 * 采集单个策展频道。
 * 优先走 API（可拿播放量/时长）；API 失败但已解析出 channel id 时回退 RSS。
 */
export async function collectFeed(
  feed: EduVideoFeed,
  apiKey: string,
): Promise<CollectedVideo[]> {
  let channelId: string | null = null;
  try {
    channelId = await resolveChannelId(feed.handle, apiKey);
  } catch (err) {
    console.warn(
      `[edu-videos] ${feed.id} 频道解析失败（${feed.handle}）：${(err as Error).message}`,
    );
  }
  if (!channelId) {
    console.warn(
      `[edu-videos] ${feed.id} 未解析到频道（handle=${feed.handle}），跳过`,
    );
    return [];
  }

  // UCxxx → UUxxx 即 uploads 播放列表
  const uploads = `UU${channelId.slice(2)}`;
  try {
    const listItems = await fetchPlaylistItems(uploads, apiKey);
    const ids = listItems
      .map((i) => i.contentDetails?.videoId)
      .filter((v): v is string => Boolean(v));
    const stats = await fetchVideoStats(ids, apiKey);
    const videos: CollectedVideo[] = [];
    for (const s of stats) {
      if (!s.id) continue;
      videos.push({
        videoId: s.id,
        title: s.snippet?.title ?? "",
        description: s.snippet?.description ?? "",
        channelTitle: s.snippet?.channelTitle ?? feed.title,
        publishedAt: s.snippet?.publishedAt ?? null,
        duration: parseDuration(s.contentDetails?.duration),
        views: s.statistics?.viewCount ? Number(s.statistics.viewCount) : null,
        likes: s.statistics?.likeCount ? Number(s.statistics.likeCount) : null,
      });
    }
    if (videos.length) return videos;
    console.warn(`[edu-videos] ${feed.id} API 返回 0 条，尝试 RSS`);
  } catch (err) {
    console.warn(
      `[edu-videos] ${feed.id} API 失败，尝试 RSS：${(err as Error).message}`,
    );
  }

  // 回退：频道 RSS（无配额，每频道约 15 条）
  try {
    const xml = await fetchHtml(`${RSS_BASE}?channel_id=${channelId}`, {
      timeout: 45000,
      headers: { Accept: "application/rss+xml,application/xml" },
    });
    return parseRssFeed(xml).map((e) => ({
      videoId: e.videoId,
      title: e.title,
      description: e.description,
      channelTitle: e.channelTitle || feed.title,
      publishedAt: e.publishedAt,
      duration: null,
      views: null,
      likes: null,
    }));
  } catch (err) {
    console.warn(`[edu-videos] ${feed.id} RSS 失败：${(err as Error).message}`);
    return [];
  }
}

/** 映射成统一的 ExternalFeedItem。 */
export function toFeedItem(
  video: CollectedVideo,
  feed: EduVideoFeed,
): ExternalFeedItem {
  const categories = matchEduCategories(
    `${feed.title} ${video.title} ${video.description.slice(0, 400)}`,
  );
  // 策展分类优先（由人指定），命中的关键词分类作为补充
  const allCategories = Array.from(
    new Set([feed.category, ...categories]),
  ).filter(Boolean);

  return {
    id: `edu-videos-${video.videoId}`,
    source: "edu-videos",
    title: video.title,
    tagline: `${video.channelTitle}${video.duration ? ` · ${Math.round(video.duration / 60)} 分钟` : ""}`,
    description: video.description,
    url: `https://www.youtube.com/watch?v=${video.videoId}`,
    externalUrl: null,
    imageUrl: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
    categories: allCategories,
    metrics: {
      score: video.views ?? undefined,
      comments: video.likes ?? undefined,
    },
    metadata: {
      videoId: video.videoId,
      feedId: feed.id,
      feedTitle: feed.title,
      channelTitle: video.channelTitle,
      durationSeconds: video.duration,
      views: video.views,
      likes: video.likes,
      note: feed.note ?? null,
    },
    fetchedAt: new Date().toISOString(),
    publishedAt: video.publishedAt,
  };
}

export class EduVideosCollector implements FeedCollector {
  source = "edu-videos" as const;

  constructor(private readonly feeds: EduVideoFeed[] = EDU_VIDEO_FEEDS) {}

  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[edu-videos] 缺少 YOUTUBE_API_KEY：handle→channel id 的解析依赖 channels.list。" +
          "请在 Google Cloud 启用 YouTube Data API v3 并提供 key；该采集器需在能访问 googleapis.com 的环境（CI）运行。",
      );
    }

    const items: ExternalFeedItem[] = [];
    const seen = new Set<string>();

    for (const feed of this.feeds) {
      const videos = await collectFeed(feed, apiKey);
      for (const v of videos) {
        if (seen.has(v.videoId)) continue;
        seen.add(v.videoId);
        items.push(toFeedItem(v, feed));
      }
      console.log(`[edu-videos] ${feed.title}: ${videos.length} 条`);
    }

    return items;
  }

  async save(): Promise<SaveResult> {
    const label = new Date().toISOString().split("T")[0];
    const items = await this.fetchLatest();
    return saveItems("edu-videos", items, label, `${label}.json`);
  }
}

export async function syncEduVideos(): Promise<void> {
  const items = await new EduVideosCollector().fetchLatest();
  if (!items.length) {
    console.warn("[edu-videos] 无数据，跳过写入");
    return;
  }
  const result = saveItems("edu-videos", items, "latest");
  console.log(
    `[edu-videos] 已写入 ${result.outDir} (${result.count} 条, ${result.bytes} bytes)`,
  );
}
