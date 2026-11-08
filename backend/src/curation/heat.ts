/**
 * GitHub Hot — M1 热度引擎（GH #63）。
 *
 * heat(repo) = Σ over 独立源 s ∈ 命中源: w_s × 2^(−hours(first_seen)/24)
 *
 * - 独立源计一次：同源多切片（如 trendshift 的多个语言榜）只贡献一次。
 * - first_seen 取该仓库全部信号中最早时间戳。
 * - velocity（starsGained）只展示，不进公式。
 * - rule_version 随每份快照落库：调权重/窗口只影响之后的日期。
 *
 * 信号源（v1）：digest / trending(SQLite) / trendshift / github-new。
 * topics、starred 暂不纳入（弱信号 / 单人偏差）。
 */

import { copyFileSync, existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { Database } from "bun:sqlite";
import {
  type HotSignalRow,
  type HotSnapshotItemRow,
  cleanupHotSnapshots,
  upsertHotSnapshot,
} from "../db/index.js";
import { loadNewestDigestDump } from "../data/digest-store.js";
import { getHiddenRepoFullNames } from "../data/hidden-store.js";

export const HOT_RULE_VERSION = "hot-v1-48h-halflife24h";

export type HotSource = "trending" | "trendshift" | "digest" | "github-new";

const SOURCE_WEIGHTS: Record<HotSource, number> = {
  digest: 4,
  trending: 3,
  trendshift: 3,
  "github-new": 2,
};

export interface HotSignal extends HotSignalRow {
  source: HotSource;
}

export interface HotItem extends HotSnapshotItemRow {
  isNew: boolean;
}

export interface HotSnapshot {
  snapshotDate: string;
  ruleVersion: string;
  generatedAt: string;
  windowHours: number;
  topN: number;
  items: HotItem[];
}

export interface BuildHotOptions {
  windowHours?: number;
  topN?: number;
  now?: Date;
  /** 显式指定 ~/.innate 根（测试注入 fixture，避免依赖共享的 process.env） */
  innateHome?: string;
  /** 显式注入 digest dump（测试密闭性；缺省读最新本地 dump） */
  digestDump?: DigestDump | null;
}

// ---------------------------------------------------------------------------
// Per-source extraction. Each returns: fullName → partial signal facts.
// ---------------------------------------------------------------------------

export interface SourceFacts {
  /** Earliest seen timestamp (ISO). */
  seenAt: string;
  /** Best (lowest) rank across slices, if the source has ranks. */
  rank?: number;
  /** Max starsGained across slices (trendshift only today). */
  starsGained?: number;
  /** Display metadata when this source is the metadata provider. */
  meta?: {
    stars?: number | null;
    description?: string | null;
    language?: string | null;
    ownerLogin?: string | null;
    createdAt?: string | null;
  };
}

type SignalMap = Map<string, SourceFacts>;

function mergeFacts(map: SignalMap, fullName: string, next: SourceFacts): void {
  const prev = map.get(fullName);
  if (!prev) {
    map.set(fullName, next);
    return;
  }
  prev.seenAt = prev.seenAt < next.seenAt ? prev.seenAt : next.seenAt;
  if (next.rank !== undefined) {
    prev.rank =
      prev.rank === undefined ? next.rank : Math.min(prev.rank, next.rank);
  }
  if (next.starsGained !== undefined) {
    prev.starsGained =
      prev.starsGained === undefined
        ? next.starsGained
        : Math.max(prev.starsGained, next.starsGained);
  }
  // Prefer richer metadata when later facts carry more fields.
  if (next.meta && (!prev.meta || rankMeta(next.meta) > rankMeta(prev.meta))) {
    prev.meta = next.meta;
  }
}

function rankMeta(m: NonNullable<SourceFacts["meta"]>): number {
  let score = 0;
  if (m.stars != null) score += 1;
  if (m.description) score += 1;
  if (m.language) score += 1;
  if (m.createdAt) score += 1;
  return score;
}

/** Trending: daily snapshots within the window (SQLite). */
export function extractTrendingSignals(
  db: Database,
  windowStart: Date,
): SignalMap {
  const sinceDate = windowStart.toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT full_name, stars, description, language, owner_login,
              created_at, snapshot_date
       FROM trending_repos
       WHERE period = 'daily' AND snapshot_date >= ?
       ORDER BY snapshot_date ASC`,
    )
    .all(sinceDate) as {
    full_name: string;
    stars: number;
    description: string | null;
    language: string | null;
    owner_login: string;
    created_at: string;
    snapshot_date: string;
  }[];
  const map: SignalMap = new Map();
  for (const row of rows) {
    // Date-granularity: anchor the snapshot at midnight UTC of its date.
    const seenAt = `${row.snapshot_date}T00:00:00.000Z`;
    mergeFacts(map, row.full_name, {
      seenAt,
      meta: {
        stars: row.stars,
        description: row.description,
        language: row.language,
        ownerLogin: row.owner_login,
        createdAt: row.created_at,
      },
    });
  }
  return map;
}

interface TrendshiftEntry {
  fullName?: string;
  rank?: number;
  starsGained?: number | null;
  periodKey?: string;
}

/**
 * Trendshift daily archives within the window (date-granularity).
 * Files: ~/.innate/trendshift/daily/{daily-*.json}, each entry carries
 * periodKey (YYYY-MM-DD). Archive step (see archiveTrendshiftDaily) keeps
 * yesterday around even though the sync overwrites daily-all.json.
 */
export function extractTrendshiftSignals(
  windowStart: Date,
  innateHome: string,
): SignalMap {
  const dir = join(innateHome, "trendshift", "daily");
  if (!existsSync(dir)) return new Map();
  const sinceDate = windowStart.toISOString().slice(0, 10);
  const map: SignalMap = new Map();
  for (const name of readdirSync(dir)) {
    if (!/^daily-.*\.json$/.test(name)) continue;
    let entries: TrendshiftEntry[];
    try {
      const parsed = JSON.parse(readFileSync(join(dir, name), "utf-8"));
      entries = Array.isArray(parsed) ? parsed : [];
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.fullName || !entry.periodKey) continue;
      if (entry.periodKey < sinceDate) continue;
      mergeFacts(map, entry.fullName, {
        seenAt: `${entry.periodKey}T00:00:00.000Z`,
        rank: typeof entry.rank === "number" ? entry.rank : undefined,
        starsGained:
          typeof entry.starsGained === "number" ? entry.starsGained : undefined,
        meta: {
          stars: null,
          description: null,
          language: null,
          createdAt: null,
        },
      });
    }
  }
  return map;
}

/**
 * Keep yesterday's trendshift archive before the next sync overwrites
 * daily-all.json: copy it to daily/{periodKey}-all.json once.
 */
export function archiveTrendshiftDaily(innateHome: string): string | null {
  const dir = join(innateHome, "trendshift", "daily");
  const src = join(dir, "daily-all.json");
  if (!existsSync(src)) return null;
  let periodKey: string | undefined;
  try {
    const entries = JSON.parse(readFileSync(src, "utf-8")) as TrendshiftEntry[];
    periodKey = entries.find((e) => e.periodKey)?.periodKey;
  } catch {
    return null;
  }
  if (!periodKey) return null;
  const dest = join(dir, `${periodKey}-all.json`);
  if (existsSync(dest)) return null;
  copyFileSync(src, dest);
  return dest;
}

interface DigestDump {
  items: {
    githubRepoFullName?: string | null;
    issueCreatedAt?: string;
    source?: string;
  }[];
}

/** Digest picks: precise issueCreatedAt, label = digest source id. */
export function extractDigestSignals(
  dump: DigestDump | null,
  windowStart: Date,
): SignalMap {
  const map: SignalMap = new Map();
  if (!dump) return map;
  const cutoff = windowStart.toISOString();
  for (const item of dump.items) {
    const fullName = item.githubRepoFullName;
    const seenAt = item.issueCreatedAt;
    if (!fullName || !seenAt || !fullName.includes("/")) continue;
    if (seenAt < cutoff) continue;
    mergeFacts(map, fullName, {
      seenAt,
      meta: {
        stars: null,
        description: null,
        language: null,
        createdAt: null,
      },
    });
    // Keep the digest source label on the signal itself (added at build time).
    const facts = map.get(fullName);
    if (facts) {
      (facts as SourceFacts & { digestLabel?: string }).digestLabel =
        item.source;
    }
  }
  return map;
}

interface GithubNewEntry {
  metadata?: { fullName?: string; createdAt?: string };
}

/** GitHub new repos: latest two new-{date}.json files. */
export function extractGithubNewSignals(
  innateHome: string,
  windowStart: Date,
): SignalMap {
  const dir = join(innateHome, "github-new");
  if (!existsSync(dir)) return new Map();
  const files = readdirSync(dir)
    .filter((n) => /^new-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort()
    .slice(-2);
  const cutoff = windowStart.toISOString();
  const map: SignalMap = new Map();
  for (const name of files) {
    let payload: { items?: GithubNewEntry[]; fetchedAt?: string };
    try {
      payload = JSON.parse(readFileSync(join(dir, name), "utf-8"));
    } catch {
      continue;
    }
    // Signal timestamp = when the repo entered this fast-growth list (fetch
    // time), NOT repo.created_at — repos may be up to `days` old when they
    // first cross the stars threshold, and their signal is "seen today".
    const seenAt = payload.fetchedAt;
    if (!seenAt || seenAt < cutoff) continue;
    for (const item of payload.items ?? []) {
      const fullName = item.metadata?.fullName;
      if (!fullName) continue;
      mergeFacts(map, fullName, {
        seenAt,
        meta: {
          stars: null,
          description: null,
          language: null,
          createdAt: item.metadata?.createdAt ?? null,
        },
      });
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Build + persist
// ---------------------------------------------------------------------------

function hoursBetween(fromIso: string, now: Date): number {
  const from = new Date(fromIso).getTime();
  const diff = now.getTime() - from;
  return Math.max(0, diff / 3_600_000);
}

/**
 * Build the ranked snapshot for `now` (injectable for tests).
 * Reads stores, merges signals per repo, applies hidden filter,
 * ranks deterministically (heat desc → stars desc → fullName asc).
 */
export function buildHotSnapshot(
  db: Database,
  opts: BuildHotOptions = {},
): HotSnapshot {
  const now = opts.now ?? new Date();
  const windowHours = opts.windowHours ?? 48;
  const topN = opts.topN ?? 50;
  const windowStart = new Date(now.getTime() - windowHours * 3_600_000);

  const home = opts.innateHome ?? innateHome();
  const trendshift = extractTrendshiftSignals(windowStart, home);
  const githubNew = extractGithubNewSignals(home, windowStart);
  const digest = extractDigestSignals(
    opts.digestDump !== undefined ? opts.digestDump : loadNewestDigestDump(),
    windowStart,
  );
  const trending = extractTrendingSignals(db, windowStart);

  const hidden = getHiddenRepoFullNames();
  const perRepo = new Map<
    string,
    { facts: SourceFacts; source: HotSource }[]
  >();
  const register = (source: HotSource, map: SignalMap) => {
    for (const [fullName, facts] of map) {
      if (hidden.has(fullName.toLowerCase())) continue;
      const list = perRepo.get(fullName) ?? [];
      list.push({ facts, source });
      perRepo.set(fullName, list);
    }
  };
  register("trending", trending);
  register("trendshift", trendshift);
  register("digest", digest);
  register("github-new", githubNew);

  const nowIso = now.toISOString();
  const snapshotDate = nowIso.slice(0, 10);
  const newCutoffIso = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const items: HotItem[] = [];
  for (const [fullName, sourceList] of perRepo) {
    // Independent sources count once each; collapse per source first.
    const bySource = new Map<
      HotSource,
      SourceFacts & { digestLabel?: string }
    >();
    let firstSeen = nowIso;
    for (const { facts, source } of sourceList) {
      const prev = bySource.get(source);
      if (!prev) {
        bySource.set(source, { ...facts });
      } else {
        prev.seenAt = prev.seenAt < facts.seenAt ? prev.seenAt : facts.seenAt;
        if (facts.rank !== undefined) {
          prev.rank =
            prev.rank === undefined
              ? facts.rank
              : Math.min(prev.rank, facts.rank);
        }
        if (facts.starsGained !== undefined) {
          prev.starsGained =
            prev.starsGained === undefined
              ? facts.starsGained
              : Math.max(prev.starsGained, facts.starsGained);
        }
        if (
          facts.meta &&
          (!prev.meta || rankMeta(facts.meta) > rankMeta(prev.meta))
        ) {
          prev.meta = facts.meta;
        }
      }
      if (facts.seenAt < firstSeen) firstSeen = facts.seenAt;
    }

    const decay = Math.pow(2, -hoursBetween(firstSeen, now) / 24);
    let heat = 0;
    const signals: HotSignal[] = [];
    for (const [source, facts] of bySource) {
      const weight = SOURCE_WEIGHTS[source];
      heat += weight * decay;
      signals.push({
        source,
        label:
          source === "digest" ? (facts.digestLabel ?? "digest") : undefined,
        rank: facts.rank,
        seenAt: facts.seenAt,
        weight,
      });
    }
    heat = Math.round(heat * 1000) / 1000;

    // Metadata: richest available (trending row usually wins); starred_repos
    // (5066 rows, full metadata) fills digest/trendshift-only repos.
    const metas = [...bySource.values()]
      .map((f) => f.meta)
      .filter((m): m is NonNullable<SourceFacts["meta"]> => Boolean(m))
      .sort((a, b) => rankMeta(b) - rankMeta(a));
    let meta = metas[0] ?? {};
    if (rankMeta(meta) === 0) {
      const starred = db
        .prepare(
          `SELECT stars, description, language, owner_login, created_at
           FROM starred_repos WHERE full_name = ? LIMIT 1`,
        )
        .get(fullName) as
        | {
            stars: number;
            description: string | null;
            language: string | null;
            owner_login: string;
            created_at: string;
          }
        | undefined;
      if (starred) {
        meta = {
          stars: starred.stars,
          description: starred.description,
          language: starred.language,
          ownerLogin: starred.owner_login,
          createdAt: starred.created_at,
        };
      }
    }
    const ownerLogin = meta.ownerLogin ?? fullName.split("/")[0];

    items.push({
      fullName,
      heat,
      rank: 0,
      stars: meta.stars ?? null,
      starsGained:
        [...bySource.values()].reduce<number | undefined>(
          (acc, f) =>
            f.starsGained !== undefined &&
            (acc === undefined || f.starsGained > acc)
              ? f.starsGained
              : acc,
          undefined,
        ) ?? null,
      description: meta.description ?? null,
      language: meta.language ?? null,
      ownerLogin,
      ownerAvatarUrl: `https://github.com/${ownerLogin}.png`,
      signals: signals.sort((a, b) => b.weight - a.weight),
      isNew: Boolean(meta.createdAt && meta.createdAt >= newCutoffIso),
    });
  }

  items.sort((a, b) => {
    if (b.heat !== a.heat) return b.heat - a.heat;
    const starsA = a.stars ?? -1;
    const starsB = b.stars ?? -1;
    if (starsB !== starsA) return starsB - starsA;
    return a.fullName.localeCompare(b.fullName);
  });
  const top = items.slice(0, topN).map((item, i) => ({ ...item, rank: i + 1 }));

  return {
    snapshotDate,
    ruleVersion: HOT_RULE_VERSION,
    generatedAt: nowIso,
    windowHours,
    topN,
    items: top,
  };
}

export function innateHome(): string {
  return process.env.INNATE_HOME || join(process.env.HOME || "", ".innate");
}

/** Persist one snapshot (replace same-date rows) + prune >30-day-old ones. */
export function saveHotSnapshot(db: Database, snapshot: HotSnapshot): number {
  upsertHotSnapshot(db, {
    snapshotDate: snapshot.snapshotDate,
    ruleVersion: snapshot.ruleVersion,
    items: snapshot.items,
  });
  return cleanupHotSnapshots(db, 30);
}
