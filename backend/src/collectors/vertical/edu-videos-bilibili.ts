/**
 * B 站教育动画教学视频采集器（sprint-3 task-B14）。
 *
 * 链路：策展 UP 清单（昵称或 mid）→ Firecrawl search 解析 mid →
 * Firecrawl 抓 space.bilibili.com/{mid}/video（waitFor 渲染）→
 * markdown 正则解析视频块（标题/BV/封面/时长/播放量）→
 * 归一为 ExternalFeedItem 落 ~/.innate/edu-videos-bilibili/。
 *
 * 配置与运行说明见 docs/arch-design/edu-videos-bilibili.md。
 */

import type {
  ExternalFeedItem,
  FeedItemMetrics,
} from "../shared/types.js";
import { saveItems } from "../shared/storage.js";

/** 策展 UP 主清单。handle 为昵称（经 search 解析 mid）或纯数字 mid。 */
export interface BilibiliEduUp {
  handle: string;
  note: string;
}

export const BILIBILI_EDU_UPS: BilibiliEduUp[] = [
  { handle: "老鹰讲AE", note: "AE 特效教程（种子候选，待策展确认）" },
  // 策展位：添加帧动画 / 手绘 / motion graphics 教学 UP，见说明文档
];

interface BiliVideoRaw {
  bvid: string;
  title: string;
  cover: string | null;
  duration: string;
  /** "12.5M" / "8900" 文本，解析为数值 */
  play: number | null;
}

function parseViews(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/^([\d.]+)([KM]?)$/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = m[2].toUpperCase() === "M" ? 1_000_000 : m[2].toUpperCase() === "K" ? 1_000 : 1;
  return Math.round(n * mult);
}

function buildItem(up: BilibiliEduUp, raw: BiliVideoRaw, fetchedAt: string): ExternalFeedItem | null {
  if (!raw.bvid || !raw.title) return null;
  const metrics: FeedItemMetrics = {};
  if (raw.play != null && raw.play > 0) metrics.score = raw.play;
  return {
    id: `bilibili-${raw.bvid}`,
    source: "edu-videos-bilibili",
    title: raw.title,
    tagline: `B 站教学视频 · ${up.handle}`,
    description: up.note,
    url: `https://www.bilibili.com/video/${raw.bvid}`,
    externalUrl: `https://space.bilibili.com/${up.handle}/video`,
    imageUrl: raw.cover,
    categories: ["edu-animation"],
    metrics,
    metadata: { platform: "bilibili", up: up.handle, bvid: raw.bvid, duration: raw.duration },
    fetchedAt,
    publishedAt: null,
  };
}

/** 渲染后的空间页 markdown → 视频块解析。 */
const VIDEO_BLOCK_RE =
  /\[!\[([^\]]*)\]\(([^)]+)\)([\s\S]*?)\]\(https:\/\/www\.bilibili\.com\/(?:en\/)?video\/(BV[A-Za-z0-9]+)[^)]*\)/g;

function parseMarkdownVideos(md: string): BiliVideoRaw[] {
  const out: BiliVideoRaw[] = [];
  let m: RegExpExecArray | null;
  VIDEO_BLOCK_RE.lastIndex = 0;
  while ((m = VIDEO_BLOCK_RE.exec(md)) !== null && out.length < 100) {
    const between = m[3];
    out.push({
      title: m[1].trim(),
      cover: m[2] || null,
      duration: between.match(/(\d{1,2}:\d{2})/)?.[1] ?? "",
      play: parseViews(between.match(/([\d.]+[KM]?)(?![\d])/)?.[1]),
      bvid: m[4],
    });
  }
  return out;
}

/** 昵称 → mid：Firecrawl search 找 space.bilibili.com/{mid}；纯数字直接当 mid。 */
async function resolveMid(handle: string): Promise<string> {
  if (/^\d+$/.test(handle)) return handle;
  const Firecrawl = (await import("firecrawl")).default;
  const fc = new Firecrawl();
  const result = await fc.search(`${handle} bilibili 个人空间`, { limit: 5 });
  const web = (result as { web?: { url?: string }[] }).web ?? [];
  for (const item of web) {
    const mid = item.url?.match(/space\.bilibili\.com\/(\d+)/)?.[1];
    if (mid) return mid;
  }
  throw new Error(`无法解析 UP「${handle}」的 mid（search 无 space.bilibili.com/{mid} 结果）`);
}

/** Firecrawl：渲染抓取 + markdown 解析（已实测：视频块在渲染后 DOM 中）。 */
async function fetchWithFirecrawl(mid: string): Promise<BiliVideoRaw[]> {
  const Firecrawl = (await import("firecrawl")).default;
  const fc = new Firecrawl();
  const page = await fc.scrape(`https://space.bilibili.com/${mid}/video`, {
    waitFor: 10000,
    formats: ["markdown"],
  });
  const md = (page as { markdown?: string }).markdown ?? "";
  return parseMarkdownVideos(md);
}

export interface BilibiliSyncSummary {
  ups: { handle: string; mid?: string; count: number; error?: string }[];
  total: number;
  save: ReturnType<typeof saveItems>;
}

/** 采集全部（或指定）策展 UP 的投稿视频并落盘。 */
export async function syncEduVideosBilibili(
  ups: BilibiliEduUp[] = BILIBILI_EDU_UPS,
): Promise<BilibiliSyncSummary> {
  const fetchedAt = new Date().toISOString();
  const items: ExternalFeedItem[] = [];
  const summary: BilibiliSyncSummary["ups"] = [];

  for (const up of ups) {
    try {
      const mid = await resolveMid(up.handle);
      const raws = await fetchWithFirecrawl(mid);
      const before = items.length;
      for (const raw of raws) {
        const item = buildItem(up, raw, fetchedAt);
        if (item) items.push(item);
      }
      summary.push({ handle: up.handle, mid, count: items.length - before });
    } catch (err) {
      summary.push({
        handle: up.handle,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const label = fetchedAt.split("T")[0];
  const save = saveItems("edu-videos-bilibili", items, label, `${label}.json`);
  return { ups: summary, total: items.length, save };
}
