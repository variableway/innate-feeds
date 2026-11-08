/**
 * Product Hunt leaderboard collector.
 *
 * Scrapes PH leaderboards in three periods (like GitHub Trending):
 *   - daily:    /leaderboard/daily/{yyyy}/{mm}/{dd}
 *   - weekly:   /leaderboard/weekly/{yyyy}/{ww}  (ISO8601 week)
 *   - monthly:  /leaderboard/monthly/{yyyy}/{mm}
 *
 * Uses Firecrawl JSON extraction (preferred) or HTML fallback.
 *
 * Run:
 *   bunx tsx src/collector/producthunt.ts                          # today daily
 *   bunx tsx src/collector/producthunt.ts --period daily --date 2026-08-25
 *   bunx tsx src/collector/producthunt.ts --period weekly --date 2026-08-25
 *   bunx tsx src/collector/producthunt.ts --period monthly --date 2026-08-01
 *   bunx tsx src/collector/producthunt.ts --period all --save      # daily+weekly+monthly
 *   bunx tsx src/collector/producthunt.ts --save                   # today, all periods
 */

import { saveItems } from "../shared/storage.js";
import { fetchHtml } from "../shared/http.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "../shared/types.js";

export type PHPeriod = "daily" | "weekly" | "monthly";

interface ProductHuntRaw {
  rank: number;
  name: string;
  tagline: string;
  description?: string;
  score?: number;
  comments?: number;
  topics?: string[];
  url?: string;
  externalUrl?: string;
  imageUrl?: string;
}

/** Get ISO8601 week number (1-53) for a date. */
function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Build the PH leaderboard URL for a given period and date. */
function buildLeaderboardUrl(period: PHPeriod, date: string): string {
  const base = "https://www.producthunt.com/leaderboard";
  const [year, month, day] = date.split("-");

  switch (period) {
    case "daily":
      return `${base}/daily/${year}/${month}/${day}`;
    case "weekly": {
      const d = new Date(date);
      const week = getISOWeek(d);
      return `${base}/weekly/${year}/${week}`;
    }
    case "monthly":
      return `${base}/monthly/${year}/${month}`;
  }
}

/**
 * Derive a label for storage (used as manifest entry label and filename stem).
 *   daily   → "2026-08-25"
 *   weekly  → "2026-W35"
 *   monthly → "2026-08"
 */
function periodLabel(period: PHPeriod, date: string): string {
  const [year, month, day] = date.split("-");
  switch (period) {
    case "daily":
      return date; // "2026-08-25"
    case "weekly": {
      const d = new Date(date);
      const week = getISOWeek(d);
      return `${year}-W${String(week).padStart(2, "0")}`;
    }
    case "monthly":
      return `${year}-${month}`;
  }
}

export class ProductHuntCollector implements FeedCollector {
  source = "producthunt" as const;

  /** Fetch the leaderboard for a specific period and date. */
  async fetchByPeriod(
    period: PHPeriod,
    date: string,
  ): Promise<ExternalFeedItem[]> {
    const attempt = async (d: string): Promise<ExternalFeedItem[]> => {
      const url = buildLeaderboardUrl(period, d);
      const label = periodLabel(period, d);
      console.error(`[producthunt] Fetching ${period} → ${url}`);
      try {
        return await this.fetchWithFirecrawl(url, label, period);
      } catch (err) {
        console.warn("[producthunt] Firecrawl failed, using HTML:", err);
        return this.fetchWithHtml(url, label, period);
      }
    };

    const items = await attempt(date);
    if (items.length || period !== "daily") return items;

    // 当日榜单可能尚未生成（PH 按 PT 日切，本地清晨常为空）：回退昨日。
    // 文件名/manifest 用请求日，条目 id/publishedAt 带实际榜单日。
    const prev = new Date(`${date}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const prevDate = prev.toISOString().split("T")[0];
    console.warn(`[producthunt] ${date} 榜单为空，回退 ${prevDate}`);
    return attempt(prevDate);
  }

  /** Fetch daily leaderboard for a date (backward compat). */
  async fetchByDate(date: string): Promise<ExternalFeedItem[]> {
    return this.fetchByPeriod("daily", date);
  }

  /** Fetch today's daily leaderboard. */
  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const today = new Date().toISOString().split("T")[0];
    return this.fetchByPeriod("daily", today);
  }

  /** Fetch all three periods for a date. */
  async fetchAll(date: string): Promise<ExternalFeedItem[]> {
    const allItems: ExternalFeedItem[] = [];
    for (const period of ["daily", "weekly", "monthly"] as PHPeriod[]) {
      const items = await this.fetchByPeriod(period, date);
      allItems.push(...items);
    }
    return allItems;
  }

  /** Save a single period. */
  async savePeriod(period: PHPeriod, date: string): Promise<SaveResult> {
    const items = await this.fetchByPeriod(period, date);
    const label = periodLabel(period, date);
    return saveItems("producthunt", items, label, `${label}.json`);
  }

  /** Save daily (backward compat). */
  async save(date: string): Promise<SaveResult> {
    return this.savePeriod("daily", date);
  }

  /** Save all three periods for a date. */
  async saveAll(date: string): Promise<SaveResult[]> {
    const results: SaveResult[] = [];
    for (const period of ["daily", "weekly", "monthly"] as PHPeriod[]) {
      const result = await this.savePeriod(period, date);
      results.push(result);
    }
    return results;
  }

  /**
   * GH #33：PH 榜单页已改为客户端渲染，JSON 提取（无 waitFor）稳定返回 0 条。
   * 改为 markdown + waitFor 渲染后解析。解析仍为 0 时抛错走 HTML 回退。
   */
  private async fetchWithFirecrawl(
    url: string,
    label: string,
    period: PHPeriod,
  ): Promise<ExternalFeedItem[]> {
    const Firecrawl = (await import("firecrawl")).default;
    const firecrawl = new Firecrawl();
    const result = await firecrawl.scrape(url, {
      formats: ["markdown"],
      waitFor: 8000,
      timeout: 90000,
    });

    // @ts-ignore Firecrawl SDK typing gap.
    const md = (result.markdown as string | undefined) ?? "";
    const items = this.parseMarkdown(md, label, period);
    if (!items.length) {
      throw new Error(
        `markdown parsed 0 products (md ${md.length} chars) — page layout may have changed`,
      );
    }
    return items;
  }

  /**
   * 解析渲染后的 leaderboard markdown（2026-11 结构）：
   *   ![Name](thumb) 前置缩略图
   *   [N\. Name](https://www.producthunt.com/products/slug)Tagline
   *   [Topic](https://www.producthunt.com/topics/…)• …
   *   upvotes / comments 两个独立数字行
   */
  private parseMarkdown(
    md: string,
    label: string,
    period: PHPeriod,
  ): ExternalFeedItem[] {
    const productRe =
      /\[(\d+)\\?\.\s*([^\]]+)\]\(https:\/\/www\.producthunt\.com\/products\/([^)/?#]+)[^)]*\)([^\n]*)/g;
    const matches: {
      rank: number;
      name: string;
      slug: string;
      tagline: string;
      start: number;
      end: number;
    }[] = [];
    let m: RegExpExecArray | null;
    while ((m = productRe.exec(md)) !== null) {
      matches.push({
        rank: Number(m[1]),
        name: m[2].trim(),
        slug: m[3],
        tagline: m[4].trim(),
        start: m.index,
        end: m.index + m[0].length,
      });
    }

    const items: ExternalFeedItem[] = [];
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      if (cur.rank > 25) break; // 榜单语义只取 top 25
      // 当前条目到下一条目之间的区段：topics / promoted 徽章 / 票数
      const next = matches[i + 1];
      const prevEnd = matches[i - 1]?.end ?? 0;
      const segment = md.slice(cur.end, next?.start ?? md.length);
      const before = md.slice(prevEnd, cur.start);

      const topics = [
        ...segment.matchAll(
          /\[([^\]]+)\]\(https:\/\/www\.producthunt\.com\/topics\//g,
        ),
      ].map((t) => t[1]);

      const nums = [...segment.matchAll(/(?:^|\n)(\d+)(?=\n|$)/gm)].map((n) =>
        Number(n[1]),
      );
      // 榜单按票数降序 → 末位数字是 upvotes，其前是 comments（实测验证）。
      const upvotes = nums.length >= 2 ? nums[nums.length - 1] : undefined;
      const comments = nums.length >= 2 ? nums[nums.length - 2] : undefined;

      const thumb = before.match(
        /!\[[^\]]*\]\((https:\/\/ph-files\.imgix\.net\/[^)]+)\)/,
      );

      items.push(
        this.normalize(
          {
            rank: cur.rank,
            name: cur.name,
            tagline: cur.tagline,
            topics,
            score: upvotes,
            comments,
            url: `https://www.producthunt.com/products/${cur.slug}`,
            imageUrl: thumb?.[1],
          },
          label,
          period,
        ),
      );
    }
    console.error(
      `[producthunt] Parsed ${items.length} products from markdown (${matches.length} links)`,
    );
    return items;
  }

  private async fetchWithHtml(
    url: string,
    label: string,
    period: PHPeriod,
  ): Promise<ExternalFeedItem[]> {
    // PH 直连被 Cloudflare 拦（403 challenge），HTML 回退仅为兜底——失败返回 []，
    // 让调用方（fetchByPeriod 的昨日回退 / vc 编排的 continue-on-error）接手。
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.warn("[producthunt] HTML fallback failed:", err);
      return [];
    }
    const items: ExternalFeedItem[] = [];

    const namePattern = /href="\/products\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match: RegExpExecArray | null;
    let rank = 0;

    const names: { slug: string; name: string }[] = [];
    while ((match = namePattern.exec(html)) !== null) {
      names.push({ slug: match[1], name: match[2].trim() });
    }

    for (const { slug, name } of names) {
      rank++;
      if (rank > 25) break;
      items.push(
        this.normalize(
          {
            rank,
            name,
            tagline: "",
            url: `https://www.producthunt.com/products/${slug}`,
          },
          label,
          period,
        ),
      );
    }

    return items;
  }

  private normalize(
    item: ProductHuntRaw,
    label: string,
    period: PHPeriod,
  ): ExternalFeedItem {
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: `producthunt-${label}-${item.rank}`,
      source: "producthunt",
      title: item.name,
      tagline: item.tagline || "",
      description: item.description || "",
      url: item.url || `https://www.producthunt.com/products/${slug}`,
      externalUrl: item.externalUrl || null,
      imageUrl: item.imageUrl || null,
      categories: item.topics || [],
      metrics: {
        score: item.score,
        comments: item.comments,
      },
      metadata: {
        rank: item.rank,
        period,
        label,
      },
      fetchedAt: new Date().toISOString(),
      publishedAt: label,
    };
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /producthunt\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const args = process.argv.slice(2);
  let date = new Date().toISOString().split("T")[0];
  let period: PHPeriod | "all" = "all";
  let save = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) date = args[++i];
    if (args[i] === "--period" && args[i + 1]) {
      period = args[++i] as PHPeriod | "all";
    }
    if (args[i] === "--save") save = true;
  }

  const collector = new ProductHuntCollector();

  if (save) {
    const run =
      period === "all"
        ? collector.saveAll(date).then((results) => {
            for (const r of results) {
              console.log(
                `Saved ${r.count} items → ${r.outDir} (${r.bytes} bytes)`,
              );
            }
          })
        : collector
            .savePeriod(period, date)
            .then((r) =>
              console.log(
                `Saved ${r.count} items → ${r.outDir} (${r.bytes} bytes)`,
              ),
            );
    run.catch(console.error);
  } else {
    const run =
      period === "all"
        ? collector
            .fetchAll(date)
            .then((items) => console.log(JSON.stringify(items, null, 2)))
        : collector
            .fetchByPeriod(period, date)
            .then((items) => console.log(JSON.stringify(items, null, 2)));
    run.catch(console.error);
  }
}
