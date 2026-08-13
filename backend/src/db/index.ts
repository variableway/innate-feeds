import { Database, type SQLQueryBindings } from "bun:sqlite";
import schemaSql from "./schema.sql" with { type: "text" };
import { getDefaultDbPath } from "./paths.js";

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

export interface FeedItemDTO {
  id: string;
  type: "trending" | "starred";
  snapshotDate?: string;
  starredAt?: string | null;
  fetchedAt?: string;
  repo: {
    id: number;
    name: string;
    fullName: string;
    description: string | null;
    url: string;
    homepage: string | null;
    stars: number;
    forks: number;
    watchers: number;
    language: string | null;
    topics: string[];
    owner: {
      login: string;
      avatarUrl: string;
      url: string;
    };
    createdAt: string;
    updatedAt: string;
  };
}

export interface FeedStatsDTO {
  totalRepos: number;
  trendingCount: number;
  starredCount: number;
  topLanguages: { name: string; count: number }[];
}

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

  if (filters.search) {
    where +=
      " AND (r.name LIKE ? OR r.description LIKE ? OR r.full_name LIKE ?)";
    const search = `%${filters.search}%`;
    params.push(search, search, search);
  }

  if (filters.date) {
    where += " AND r.snapshot_date = ?";
    params.push(filters.date);
  } else {
    // Default to latest snapshot date when no date filter is provided
    where +=
      " AND r.snapshot_date = (SELECT MAX(snapshot_date) FROM trending_repos)";
  }

  const sortColumn =
    filters.sort === "updated"
      ? "r.updated_at"
      : filters.sort === "created"
        ? "r.created_at"
        : "r.stars";
  const order = filters.order === "asc" ? "ASC" : "DESC";

  const countStmt = db.prepare(`
    SELECT COUNT(DISTINCT r.github_repo_id) as total
    FROM trending_repos r
    ${where}
  `);
  const { total } = countStmt.get(...params) as { total: number };

  const offset = (page - 1) * pageSize;
  const itemsStmt = db.prepare(`
    SELECT
      MIN(r.id) as id,
      r.github_repo_id as repo_id, r.name, r.full_name, r.description, r.url, r.homepage,
      r.stars, r.forks, r.watchers, r.language,
      r.owner_login, r.owner_avatar_url, r.owner_url,
      r.created_at, r.updated_at,
      MIN(r.snapshot_date) as snapshot_date
    FROM trending_repos r
    ${where}
    GROUP BY r.github_repo_id
    ORDER BY ${sortColumn} ${order}
    LIMIT ? OFFSET ?
  `);

  const rows = itemsStmt.all(...params, pageSize, offset) as TrendingItemRow[];

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

  if (filters.search) {
    where +=
      " AND (r.name LIKE ? OR r.description LIKE ? OR r.full_name LIKE ?)";
    const search = `%${filters.search}%`;
    params.push(search, search, search);
  }

  if (filters.starsMin != null) {
    where += " AND r.stars >= ?";
    params.push(filters.starsMin);
  }

  if (filters.starsMax != null) {
    where += " AND r.stars <= ?";
    params.push(filters.starsMax);
  }

  const sortColumn =
    filters.sort === "updated"
      ? "r.updated_at"
      : filters.sort === "created"
        ? "r.created_at"
        : filters.sort === "starred"
          ? "r.starred_at"
          : "r.stars";
  const order = filters.order === "asc" ? "ASC" : "DESC";

  const countStmt = db.prepare(
    `SELECT COUNT(*) as total FROM starred_repos r ${where}`,
  );
  const { total } = countStmt.get(...params) as { total: number };

  const offset = (page - 1) * pageSize;
  const itemsStmt = db.prepare(`
    SELECT
      r.id as repo_id, r.name, r.full_name, r.description, r.url, r.homepage,
      r.stars, r.forks, r.watchers, r.language,
      r.owner_login, r.owner_avatar_url, r.owner_url,
      r.created_at, r.updated_at, r.starred_at, r.fetched_at
    FROM starred_repos r
    ${where}
    ORDER BY ${sortColumn} ${order}
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
