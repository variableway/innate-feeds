import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { getDefaultDbPath } from "./paths.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let db: Database.Database | null = null;
let activeDbPath: string | null = null;

export function getDb(dbPath?: string): Database.Database {
  const resolved = dbPath || getDefaultDbPath();
  if (!db || activeDbPath !== resolved) {
    if (db) {
      db.close();
    }
    db = new Database(resolved);
    activeDbPath = resolved;
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
    db.exec(schema);
  }
  return db;
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
  db: Database.Database,
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
  stmt.run(repo);
}

export function upsertStarredRepo(
  db: Database.Database,
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
  stmt.run(repo);
}

export function insertTrendingTopics(
  db: Database.Database,
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
  db: Database.Database,
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
  params: unknown[],
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

export function getFeedItems(
  db: Database.Database,
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
): { items: any[]; total: number } {
  if (type === "trending") {
    return getTrendingItems(db, filters, page, pageSize);
  }
  return getStarredItems(db, filters, page, pageSize);
}

function getTrendingItems(
  db: Database.Database,
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
): { items: any[]; total: number } {
  let where = "WHERE 1=1";
  const params: any[] = [];

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

  const rows = itemsStmt.all(...params, pageSize, offset) as any[];

  const items = rows.map((row) => {
    const topicsStmt = db.prepare(
      "SELECT topic FROM trending_repo_topics WHERE repo_id = ?",
    );
    const topics = (topicsStmt.all(row.id) as { topic: string }[]).map(
      (t) => t.topic,
    );

    return {
      id: row.id,
      type: "trending",
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
  db: Database.Database,
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
): { items: any[]; total: number } {
  let where = "WHERE 1=1";
  const params: any[] = [];

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

  const rows = itemsStmt.all(...params, pageSize, offset) as any[];

  const items = rows.map((row) => {
    const topicsStmt = db.prepare(
      "SELECT topic FROM starred_repo_topics WHERE repo_id = ?",
    );
    const topics = (topicsStmt.all(row.repo_id) as { topic: string }[]).map(
      (t) => t.topic,
    );

    return {
      id: `starred-${row.repo_id}`,
      type: "starred",
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

export function getTrendingDates(db: Database.Database): string[] {
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

export function getStats(db: Database.Database): any {
  const trendingCount = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT github_repo_id) as count FROM trending_repos",
      )
      .get() as any
  ).count;
  const starredCount = (
    db.prepare("SELECT COUNT(*) as count FROM starred_repos").get() as any
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
    topLanguages,
  };
}

export function getLanguages(db: Database.Database): string[] {
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

export function getLatestStarredAt(db: Database.Database): string | null {
  const row = db
    .prepare("SELECT MAX(starred_at) as starred_at FROM starred_repos")
    .get() as
    | {
        starred_at: string | null;
      }
    | undefined;
  return row?.starred_at || null;
}
