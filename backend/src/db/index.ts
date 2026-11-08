import { Database, type SQLQueryBindings } from "bun:sqlite";
import schemaSql from "./schema.sql" with { type: "text" };
import { getDefaultDbPath } from "./paths.js";
import { getHiddenRepoFullNames } from "../data/hidden-store.js";

let db: Database | null = null;
let activeDbPath: string | null = null;

export function getDb(dbPath?: string): Database {
  const resolved = dbPath || getDefaultDbPath();
  if (!db || activeDbPath !== resolved) {
    if (db) {
      db.close();
    }
    db = new Database(resolved);
    activeDbPath = resolved;
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");

    db.exec(schemaSql);
    // Rebuild both FTS5 indexes from their content tables on every connection
    // init: cheap at the current scale (~7k rows) and self-healing for
    // databases written before FTS5 existed or outside the sync triggers.
    db.exec(
      "INSERT INTO trending_repos_fts(trending_repos_fts) VALUES ('rebuild')",
    );
    db.exec(
      "INSERT INTO starred_repos_fts(starred_repos_fts) VALUES ('rebuild')",
    );
  }
  return db;
}

/**
 * Prefix object keys with `@` for bun:sqlite named-parameter binding.
 * bun:sqlite requires the prefix in the key (better-sqlite3 did not).
 * Typed as `SQLQueryBindings` because @types/bun's `Statement.run` overload
 * does not model the named-binding record form (supported at runtime).
 */
export function atParams(obj: object): SQLQueryBindings {
  const out: Record<string, SQLQueryBindings> = {};
  for (const [k, v] of Object.entries(obj))
    out[`@${k}`] = v as SQLQueryBindings;
  return out as unknown as SQLQueryBindings;
}

export interface TrendingRepoRow {
  id: string;
  github_repo_id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  language: string | null;
  owner_login: string;
  owner_avatar_url: string;
  owner_url: string;
  created_at: string;
  updated_at: string;
  period: string;
  snapshot_date: string;
  fetched_at: string;
}

export interface StarredRepoRow {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  language: string | null;
  owner_login: string;
  owner_avatar_url: string;
  owner_url: string;
  created_at: string;
  updated_at: string;
  starred_at: string | null;
  fetched_at: string;
}

export function upsertTrendingRepo(
  db: Database,
  repo: Omit<TrendingRepoRow, "fetched_at">,
): void {
  const stmt = db.prepare(`
    INSERT INTO trending_repos (
      id, github_repo_id, name, full_name, description, url, homepage,
      stars, forks, watchers, language, owner_login, owner_avatar_url, owner_url,
      created_at, updated_at, period, snapshot_date
    )
    VALUES (
      @id, @github_repo_id, @name, @full_name, @description, @url, @homepage,
      @stars, @forks, @watchers, @language, @owner_login, @owner_avatar_url, @owner_url,
      @created_at, @updated_at, @period, @snapshot_date
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      full_name = excluded.full_name,
      description = excluded.description,
      url = excluded.url,
      homepage = excluded.homepage,
      stars = excluded.stars,
      forks = excluded.forks,
      watchers = excluded.watchers,
      language = excluded.language,
      owner_login = excluded.owner_login,
      owner_avatar_url = excluded.owner_avatar_url,
      owner_url = excluded.owner_url,
      updated_at = excluded.updated_at,
      period = excluded.period,
      snapshot_date = excluded.snapshot_date,
      fetched_at = datetime('now')
  `);
  stmt.run(atParams(repo));
}

export function upsertStarredRepo(
  db: Database,
  repo: Omit<StarredRepoRow, "fetched_at">,
): void {
  const stmt = db.prepare(`
    INSERT INTO starred_repos (
      id, name, full_name, description, url, homepage,
      stars, forks, watchers, language, owner_login, owner_avatar_url, owner_url,
      created_at, updated_at, starred_at
    )
    VALUES (
      @id, @name, @full_name, @description, @url, @homepage,
      @stars, @forks, @watchers, @language, @owner_login, @owner_avatar_url, @owner_url,
      @created_at, @updated_at, @starred_at
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      full_name = excluded.full_name,
      description = excluded.description,
      url = excluded.url,
      homepage = excluded.homepage,
      stars = excluded.stars,
      forks = excluded.forks,
      watchers = excluded.watchers,
      language = excluded.language,
      owner_login = excluded.owner_login,
      owner_avatar_url = excluded.owner_avatar_url,
      owner_url = excluded.owner_url,
      updated_at = excluded.updated_at,
      starred_at = excluded.starred_at,
      fetched_at = datetime('now')
  `);
  stmt.run(atParams(repo));
}

export function deleteTrendingSnapshot(
  db: Database,
  snapshotDate: string,
  period: string,
): void {
  const rows = db
    .prepare(
      `SELECT id FROM trending_repos WHERE snapshot_date = ? AND period = ?`,
    )
    .all(snapshotDate, period) as Array<{ id: string }>;

  const deleteTopics = db.prepare(
    `DELETE FROM trending_repo_topics WHERE repo_id = ?`,
  );
  const deleteRepo = db.prepare(`DELETE FROM trending_repos WHERE id = ?`);

  for (const row of rows) {
    deleteTopics.run(row.id);
    deleteRepo.run(row.id);
  }
}

export function insertTrendingTopics(
  db: Database,
  repoId: string,
  topics: string[],
): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO trending_repo_topics (repo_id, topic) VALUES (?, ?)
  `);
  for (const topic of topics) {
    stmt.run(repoId, topic);
  }
}

export function insertStarredTopics(
  db: Database,
  repoId: number,
  topics: string[],
): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO starred_repo_topics (repo_id, topic) VALUES (?, ?)
  `);
  for (const topic of topics) {
    stmt.run(repoId, topic);
  }
}

function appendTopicFilters(
  where: string,
  params: SQLQueryBindings[],
  topics: string[] | undefined,
  topicsTable: "trending_repo_topics" | "starred_repo_topics",
): string {
  if (!topics?.length) return where;
  let result = where;
  for (const topic of topics) {
    result += ` AND EXISTS (SELECT 1 FROM ${topicsTable} rt WHERE rt.repo_id = r.id AND rt.topic = ?)`;
    params.push(topic);
  }
  return result;
}

/** Exclude repos the user hid (matched by lowercased full_name). */
function appendHiddenRepoFilter(
  where: string,
  params: SQLQueryBindings[],
): string {
  const hidden = [...getHiddenRepoFullNames()];
  if (hidden.length === 0) return where;
  const placeholders = hidden.map(() => "?").join(", ");
  params.push(...hidden);
  return `${where} AND LOWER(r.full_name) NOT IN (${placeholders})`;
}

/**
 * Convert free-text user input into a safe FTS5 MATCH expression: every
 * whitespace-separated term becomes a quoted prefix phrase, so punctuation
 * can never break the query syntax and "repo" also matches "repositories".
 * Multiple terms are combined with implicit AND. Returns null when the input
 * contains no usable term.
 */
export function toFtsQuery(search: string): string | null {
  const terms = search
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replaceAll('"', '""')}"*`);
  return terms.length > 0 ? terms.join(" ") : null;
}

export interface TrendingItemRow {
  id: string;
  repo_id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  language: string | null;
  owner_login: string;
  owner_avatar_url: string;
  owner_url: string;
  created_at: string;
  updated_at: string;
  snapshot_date: string;
}

export interface StarredItemRow {
  repo_id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  language: string | null;
  owner_login: string;
  owner_avatar_url: string;
  owner_url: string;
  created_at: string;
  updated_at: string;
  starred_at: string | null;
  fetched_at: string;
}

/** S0：跨层 wire 契约收敛至 shared/types/feeds，DTO 名保留为别名（后端内部沿用）。 */
export type {
  GitHubRepo,
  FeedItem,
  FeedResponse,
  FeedFilters,
} from "../../../shared/types/feeds.js";
import type { FeedItem, FeedStats } from "../../../shared/types/feeds.js";

export type FeedItemDTO = FeedItem;
export type FeedStatsDTO = FeedStats;

function batchFetchTopics(
  db: Database,
  repoIds: (string | number)[],
  table: "trending_repo_topics" | "starred_repo_topics",
): Map<string | number, string[]> {
  const result = new Map<string | number, string[]>();
  if (repoIds.length === 0) return result;

  const placeholders = repoIds.map(() => "?").join(",");
  const stmt = db.prepare(
    `SELECT repo_id, topic FROM ${table} WHERE repo_id IN (${placeholders})`,
  );
  const rows = stmt.all(...repoIds) as {
    repo_id: string | number;
    topic: string;
  }[];
  for (const row of rows) {
    const existing = result.get(row.repo_id) ?? [];
    existing.push(row.topic);
    result.set(row.repo_id, existing);
  }
  return result;
}

export function getFeedItems(
  db: Database,
  type: string,
  filters: {
    language?: string;
    topics?: string[];
    search?: string;
    sort?: string;
    order?: string;
    date?: string;
    starsMin?: number;
    starsMax?: number;
  },
  page = 1,
  pageSize = 20,
): { items: FeedItemDTO[]; total: number } {
  if (type === "trending") {
    return getTrendingItems(db, filters, page, pageSize);
  }
  return getStarredItems(db, filters, page, pageSize);
}

function getTrendingItems(
  db: Database,
  filters: {
    language?: string;
    topics?: string[];
    search?: string;
    sort?: string;
    order?: string;
    date?: string;
  },
  page: number,
  pageSize: number,
): { items: FeedItemDTO[]; total: number } {
  let where = "WHERE 1=1";
  const params: SQLQueryBindings[] = [];
  const ftsQuery = toFtsQuery(filters.search ?? "");

  if (filters.language) {
    where += " AND r.language = ?";
    params.push(filters.language);
  }

  where = appendTopicFilters(
    where,
    params,
    filters.topics,
    "trending_repo_topics",
  );

  if (filters.date) {
    where += " AND r.snapshot_date = ?";
    params.push(filters.date);
  } else {
    // Default to latest snapshot date when no date filter is provided
    where +=
      " AND r.snapshot_date = (SELECT MAX(snapshot_date) FROM trending_repos)";
  }

  where = appendHiddenRepoFilter(where, params);

  const sortColumn =
    filters.sort === "updated"
      ? "r.updated_at"
      : filters.sort === "created"
        ? "r.created_at"
        : "r.stars";
  const order = filters.order === "asc" ? "ASC" : "DESC";

  // FTS search: the count query filters with a direct MATCH, while the items
  // query joins a per-row bm25() rank subquery — auxiliary functions like
  // bm25() only evaluate per matched row, so grouped (GROUP BY) results rank
  // via MIN(rank) over that subquery column. The subquery's LIMIT -1 is a
  // no-op row-wise but stops SQLite from flattening it into the aggregate
  // outer query (which would make bm25() fail with "unable to use function
  // bm25 in the requested context"). Without an explicit sort, searching
  // orders by relevance (bm25: smaller = better).
  const countFromClause = ftsQuery
    ? "FROM trending_repos r JOIN trending_repos_fts ON trending_repos_fts.rowid = r.rowid"
    : "FROM trending_repos r";
  const countWhere = ftsQuery
    ? `${where} AND trending_repos_fts MATCH ?`
    : where;
  const countParams = ftsQuery ? [...params, ftsQuery] : params;

  const itemsFromClause = ftsQuery
    ? `FROM trending_repos r JOIN (
        SELECT rowid AS fts_rowid, bm25(trending_repos_fts) AS fts_rank
        FROM trending_repos_fts WHERE trending_repos_fts MATCH ? LIMIT -1
      ) fts ON fts.fts_rowid = r.rowid`
    : "FROM trending_repos r";
  const itemsParams = ftsQuery ? [ftsQuery, ...params] : params;
  const orderBy =
    ftsQuery && !filters.sort
      ? "MIN(fts.fts_rank) ASC"
      : `${sortColumn} ${order}`;

  const countStmt = db.prepare(`
    SELECT COUNT(DISTINCT r.github_repo_id) as total
    ${countFromClause}
    ${countWhere}
  `);
  const { total } = countStmt.get(...countParams) as { total: number };

  const offset = (page - 1) * pageSize;
  const itemsStmt = db.prepare(`
    SELECT
      MIN(r.id) as id,
      r.github_repo_id as repo_id, r.name, r.full_name, r.description, r.url, r.homepage,
      r.stars, r.forks, r.watchers, r.language,
      r.owner_login, r.owner_avatar_url, r.owner_url,
      r.created_at, r.updated_at,
      MIN(r.snapshot_date) as snapshot_date
    ${itemsFromClause}
    ${where}
    GROUP BY r.github_repo_id
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `);
  const rows = itemsStmt.all(
    ...itemsParams,
    pageSize,
    offset,
  ) as TrendingItemRow[];

  const repoIds = rows.map((r) => r.id);
  const topicsMap = batchFetchTopics(db, repoIds, "trending_repo_topics");

  const items = rows.map((row) => {
    const topics = topicsMap.get(row.id) ?? [];

    return {
      id: row.id,
      type: "trending" as const,
      snapshotDate: row.snapshot_date,
      repo: {
        id: row.repo_id,
        name: row.name,
        fullName: row.full_name,
        description: row.description,
        url: row.url,
        homepage: row.homepage,
        stars: row.stars,
        forks: row.forks,
        watchers: row.watchers,
        language: row.language,
        topics,
        owner: {
          login: row.owner_login,
          avatarUrl: row.owner_avatar_url,
          url: row.owner_url,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  });

  return { items, total };
}

function getStarredItems(
  db: Database,
  filters: {
    language?: string;
    topics?: string[];
    search?: string;
    sort?: string;
    order?: string;
    starsMin?: number;
    starsMax?: number;
  },
  page: number,
  pageSize: number,
): { items: FeedItemDTO[]; total: number } {
  let where = "WHERE 1=1";
  const params: SQLQueryBindings[] = [];
  const ftsQuery = toFtsQuery(filters.search ?? "");

  if (filters.language) {
    where += " AND r.language = ?";
    params.push(filters.language);
  }

  where = appendTopicFilters(
    where,
    params,
    filters.topics,
    "starred_repo_topics",
  );

  if (ftsQuery) {
    where += " AND starred_repos_fts MATCH ?";
    params.push(ftsQuery);
  }

  if (filters.starsMin != null) {
    where += " AND r.stars >= ?";
    params.push(filters.starsMin);
  }

  if (filters.starsMax != null) {
    where += " AND r.stars <= ?";
    params.push(filters.starsMax);
  }

  where = appendHiddenRepoFilter(where, params);

  const sortColumn =
    filters.sort === "updated"
      ? "r.updated_at"
      : filters.sort === "created"
        ? "r.created_at"
        : filters.sort === "starred"
          ? "r.starred_at"
          : "r.stars";
  const order = filters.order === "asc" ? "ASC" : "DESC";

  // Same FTS join/ordering rules as getTrendingItems: join only when
  // searching, relevance wins when the caller did not request a sort.
  const fromClause = ftsQuery
    ? "FROM starred_repos r JOIN starred_repos_fts ON starred_repos_fts.rowid = r.rowid"
    : "FROM starred_repos r";
  const orderBy =
    ftsQuery && !filters.sort
      ? "bm25(starred_repos_fts) ASC"
      : `${sortColumn} ${order}`;

  const countStmt = db.prepare(
    `SELECT COUNT(*) as total ${fromClause} ${where}`,
  );
  const { total } = countStmt.get(...params) as { total: number };

  const offset = (page - 1) * pageSize;
  const itemsStmt = db.prepare(`
    SELECT
      r.id as repo_id, r.name, r.full_name, r.description, r.url, r.homepage,
      r.stars, r.forks, r.watchers, r.language,
      r.owner_login, r.owner_avatar_url, r.owner_url,
      r.created_at, r.updated_at, r.starred_at, r.fetched_at
    ${fromClause}
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `);

  const rows = itemsStmt.all(...params, pageSize, offset) as StarredItemRow[];

  const repoIds = rows.map((r) => r.repo_id);
  const topicsMap = batchFetchTopics(db, repoIds, "starred_repo_topics");

  const items = rows.map((row) => {
    const topics = topicsMap.get(row.repo_id) ?? [];

    return {
      id: `starred-${row.repo_id}`,
      type: "starred" as const,
      starredAt: row.starred_at,
      fetchedAt: row.fetched_at,
      repo: {
        id: row.repo_id,
        name: row.name,
        fullName: row.full_name,
        description: row.description,
        url: row.url,
        homepage: row.homepage,
        stars: row.stars,
        forks: row.forks,
        watchers: row.watchers,
        language: row.language,
        topics,
        owner: {
          login: row.owner_login,
          avatarUrl: row.owner_avatar_url,
          url: row.owner_url,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  });

  return { items, total };
}

export function getTrendingDates(db: Database): string[] {
  const rows = db
    .prepare(
      `
    SELECT DISTINCT snapshot_date
    FROM trending_repos
    ORDER BY snapshot_date DESC
    LIMIT 30
  `,
    )
    .all() as { snapshot_date: string }[];
  return rows.map((r) => r.snapshot_date);
}

export function getStats(db: Database): FeedStatsDTO {
  const trendingCount = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT github_repo_id) as count FROM trending_repos",
      )
      .get() as { count: number }
  ).count;
  const starredCount = (
    db.prepare("SELECT COUNT(*) as count FROM starred_repos").get() as {
      count: number;
    }
  ).count;
  const totalRepos = trendingCount + starredCount;

  const topLanguages = db
    .prepare(
      `
    SELECT language, COUNT(*) as count
    FROM (
      SELECT language FROM trending_repos WHERE language IS NOT NULL
      UNION ALL
      SELECT language FROM starred_repos WHERE language IS NOT NULL
    )
    GROUP BY language
    ORDER BY count DESC
    LIMIT 10
  `,
    )
    .all() as { language: string; count: number }[];

  return {
    totalRepos,
    trendingCount,
    starredCount,
    topLanguages: topLanguages.map((l) => ({
      name: l.language,
      count: l.count,
    })),
  };
}

export function getLanguages(db: Database): string[] {
  const rows = db
    .prepare(
      `
    SELECT DISTINCT language FROM (
      SELECT language FROM trending_repos WHERE language IS NOT NULL
      UNION
      SELECT language FROM starred_repos WHERE language IS NOT NULL
    )
    ORDER BY language
  `,
    )
    .all() as { language: string }[];
  return rows.map((r) => r.language);
}

export function getLatestStarredAt(db: Database): string | null {
  const row = db
    .prepare("SELECT MAX(starred_at) as starred_at FROM starred_repos")
    .get() as
    | {
        starred_at: string | null;
      }
    | undefined;
  return row?.starred_at || null;
}

/** Distinct starred repos whose `starred_at` is on or after `sinceIso`. */
export function listStarredFullNamesSince(
  db: Database,
  sinceIso: string,
): string[] {
  const rows = db
    .prepare(
      `
    SELECT DISTINCT full_name
    FROM starred_repos
    WHERE starred_at IS NOT NULL AND starred_at >= ?
    ORDER BY starred_at DESC
  `,
    )
    .all(sinceIso) as { full_name: string }[];
  return rows.map((r) => r.full_name);
}

export interface NewStarredOptions {
  /** ISO timestamp lower bound (inclusive) on `starred_at`. */
  since?: string;
  /** Shorthand for `since`: now minus N days. Ignored when `since` is set. */
  days?: number;
}

/**
 * Starred repos whose `starred_at` is on or after the cutoff, newest first.
 *
 * Backs the "new starred" export (GH #39). Unlike
 * {@link listStarredFullNamesSince} this returns full feed DTOs so the CLI can
 * emit a self-contained JSON file, and it applies the same hidden-repo filter
 * as the API list endpoints.
 */
export function listNewStarredItems(
  db: Database,
  opts: NewStarredOptions = {},
  limit = 500,
): FeedItemDTO[] {
  const since =
    opts.since ||
    (opts.days != null
      ? new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000)
          .toISOString()
          .replace(/\.\d{3}Z$/, "Z")
      : undefined);
  if (!since) {
    throw new Error("listNewStarredItems requires --days or --since");
  }

  let where = "WHERE r.starred_at IS NOT NULL AND r.starred_at >= ?";
  const params: SQLQueryBindings[] = [since];
  where = appendHiddenRepoFilter(where, params);

  const rows = db
    .prepare(
      `
    SELECT
      r.id as repo_id, r.name, r.full_name, r.description, r.url, r.homepage,
      r.stars, r.forks, r.watchers, r.language,
      r.owner_login, r.owner_avatar_url, r.owner_url,
      r.created_at, r.updated_at, r.starred_at, r.fetched_at
    FROM starred_repos r
    ${where}
    ORDER BY r.starred_at DESC
    LIMIT ?
  `,
    )
    .all(...params, limit) as StarredItemRow[];

  const topicsMap = batchFetchTopics(
    db,
    rows.map((r) => r.repo_id),
    "starred_repo_topics",
  );

  return rows.map((row) => {
    const topics = topicsMap.get(row.repo_id) ?? [];
    return {
      id: `starred-${row.repo_id}`,
      type: "starred" as const,
      starredAt: row.starred_at,
      fetchedAt: row.fetched_at,
      repo: {
        id: row.repo_id,
        name: row.name,
        fullName: row.full_name,
        description: row.description,
        url: row.url,
        homepage: row.homepage,
        stars: row.stars,
        forks: row.forks,
        watchers: row.watchers,
        language: row.language,
        topics,
        owner: {
          login: row.owner_login,
          avatarUrl: row.owner_avatar_url,
          url: row.owner_url,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  });
}

/**
 * Distinct repo full names (lowercased) already known to the feed tables.
 *
 * Used by the GitHub Topics datasource (GH #24): repos that already exist in
 * trending/starred are flagged as "existing" instead of being reported as new
 * discoveries.
 */
export function listKnownRepoFullNames(db: Database): Set<string> {
  const rows = db
    .prepare(
      `
    SELECT full_name FROM trending_repos
    UNION
    SELECT full_name FROM starred_repos
  `,
    )
    .all() as { full_name: string }[];
  return new Set(rows.map((r) => r.full_name.toLowerCase()));
}

/** Distinct trending repos that appeared in a snapshot on or after `sinceDate` (YYYY-MM-DD). */
export function listTrendingFullNamesSince(
  db: Database,
  sinceDate: string,
): string[] {
  const rows = db
    .prepare(
      `
    SELECT DISTINCT full_name
    FROM trending_repos
    WHERE snapshot_date >= ?
    ORDER BY full_name
  `,
    )
    .all(sinceDate) as { full_name: string }[];
  return rows.map((r) => r.full_name);
}

// ---- GitHub Hot (GH #63) ----------------------------------------------------

export interface HotSignalRow {
  source: string;
  label?: string;
  rank?: number;
  seenAt: string;
  weight: number;
}

export interface HotSnapshotItemRow {
  fullName: string;
  heat: number;
  rank: number;
  stars: number | null;
  starsGained: number | null;
  description: string | null;
  language: string | null;
  ownerLogin: string | null;
  ownerAvatarUrl: string | null;
  signals: HotSignalRow[];
}

/** Replace the whole snapshot for one date in a single transaction. */
export function upsertHotSnapshot(
  db: Database,
  args: {
    snapshotDate: string;
    ruleVersion: string;
    items: HotSnapshotItemRow[];
  },
): void {
  const insert = db.prepare(`
    INSERT INTO hot_snapshots (
      id, snapshot_date, rule_version, full_name, rank, heat, signals_json,
      stars, stars_gained, description, language, owner_login, owner_avatar_url
    ) VALUES (
      $id, $snapshotDate, $ruleVersion, $fullName, $rank, $heat, $signalsJson,
      $stars, $starsGained, $description, $language, $ownerLogin, $ownerAvatarUrl
    )
  `);
  const del = db.prepare(`DELETE FROM hot_snapshots WHERE snapshot_date = ?`);
  const tx = db.transaction(() => {
    del.run(args.snapshotDate);
    for (const item of args.items) {
      insert.run({
        id: `${args.snapshotDate}#${item.rank}`,
        snapshotDate: args.snapshotDate,
        ruleVersion: args.ruleVersion,
        fullName: item.fullName,
        rank: item.rank,
        heat: item.heat,
        signalsJson: JSON.stringify(item.signals),
        stars: item.stars,
        starsGained: item.starsGained,
        description: item.description,
        language: item.language,
        ownerLogin: item.ownerLogin,
        ownerAvatarUrl: item.ownerAvatarUrl,
      });
    }
  });
  tx();
}

interface HotDbRow {
  snapshot_date: string;
  rule_version: string;
  full_name: string;
  rank: number;
  heat: number;
  signals_json: string;
  stars: number | null;
  stars_gained: number | null;
  description: string | null;
  language: string | null;
  owner_login: string | null;
  owner_avatar_url: string | null;
  created_at: string;
}

function rowToItem(row: HotDbRow): HotSnapshotItemRow {
  let signals: HotSignalRow[] = [];
  try {
    const parsed = JSON.parse(row.signals_json) as HotSignalRow[];
    if (Array.isArray(parsed)) signals = parsed;
  } catch {
    signals = [];
  }
  return {
    fullName: row.full_name,
    heat: row.heat,
    rank: row.rank,
    stars: row.stars,
    starsGained: row.stars_gained,
    description: row.description,
    language: row.language,
    ownerLogin: row.owner_login,
    ownerAvatarUrl: row.owner_avatar_url,
    signals,
  };
}

/** Latest snapshot (by snapshot_date), or one specific date. */
export function getHotSnapshot(
  db: Database,
  date?: string,
  limit?: number,
): { snapshotDate: string; ruleVersion: string; generatedAt: string; items: HotSnapshotItemRow[] } | null {
  const row = (
    date
      ? db
          .prepare(
            `SELECT snapshot_date, rule_version, created_at FROM hot_snapshots
             WHERE snapshot_date = ? LIMIT 1`,
          )
          .get(date)
      : db
          .prepare(
            `SELECT snapshot_date, rule_version, created_at FROM hot_snapshots
             ORDER BY snapshot_date DESC LIMIT 1`,
          )
          .get()
  ) as HotDbRow | undefined;
  if (!row) return null;
  const cap = limit ?? 50;
  const items = db
    .prepare(
      `SELECT * FROM hot_snapshots WHERE snapshot_date = ? ORDER BY rank ASC LIMIT ${Math.max(1, Math.min(cap, 200))}`,
    )
    .all(row.snapshot_date) as HotDbRow[];
  return {
    snapshotDate: row.snapshot_date,
    ruleVersion: row.rule_version,
    generatedAt: row.created_at,
    items: items.map(rowToItem),
  };
}

/** Distinct snapshot dates, newest first. */
export function getHotSnapshotDates(db: Database): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT snapshot_date FROM hot_snapshots ORDER BY snapshot_date DESC`,
    )
    .all() as { snapshot_date: string }[];
  return rows.map((r) => r.snapshot_date);
}

/** Delete snapshots older than keepDays; returns removed row count. */
export function cleanupHotSnapshots(
  db: Database,
  keepDays = 30,
): number {
  const cutoff = new Date(Date.now() - keepDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const info = db
    .prepare(`DELETE FROM hot_snapshots WHERE snapshot_date < ?`)
    .run(cutoff);
  return info.changes;
}
