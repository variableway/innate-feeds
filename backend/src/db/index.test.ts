import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
  return db;
}

function insertTrendingRepo(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    github_repo_id: number;
    full_name: string;
    name: string;
    stars: number;
    language: string | null;
    snapshot_date: string;
    period: string;
  }> = {},
) {
  const defaults = {
    id: `trending-2024-01-01-daily-${Date.now()}-${Math.random()}`,
    github_repo_id: Math.floor(Math.random() * 1000000),
    name: "test-repo",
    full_name: "user/test-repo",
    description: "A test repo",
    url: "https://github.com/user/test-repo",
    homepage: null as string | null,
    stars: 100,
    forks: 10,
    watchers: 5,
    language: "TypeScript" as string | null,
    owner_login: "user",
    owner_avatar_url: "https://github.com/user.png",
    owner_url: "https://github.com/user",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    period: "daily",
    snapshot_date: "2024-01-01",
  };
  const repo = { ...defaults, ...overrides };
  db.prepare(`
    INSERT INTO trending_repos (
      id, github_repo_id, name, full_name, description, url, homepage,
      stars, forks, watchers, language, owner_login, owner_avatar_url, owner_url,
      created_at, updated_at, period, snapshot_date
    ) VALUES (
      @id, @github_repo_id, @name, @full_name, @description, @url, @homepage,
      @stars, @forks, @watchers, @language, @owner_login, @owner_avatar_url, @owner_url,
      @created_at, @updated_at, @period, @snapshot_date
    )
  `).run(repo);
  return repo;
}

function insertStarredRepo(
  db: Database.Database,
  overrides: Partial<{
    id: number;
    full_name: string;
    name: string;
    stars: number;
    language: string | null;
    starred_at: string;
  }> = {},
) {
  const defaults = {
    id: Math.floor(Math.random() * 1000000),
    name: "starred-repo",
    full_name: "user/starred-repo",
    description: "A starred repo",
    url: "https://github.com/user/starred-repo",
    homepage: null as string | null,
    stars: 500,
    forks: 50,
    watchers: 25,
    language: "Python" as string | null,
    owner_login: "user",
    owner_avatar_url: "https://github.com/user.png",
    owner_url: "https://github.com/user",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    starred_at: "2024-06-01T00:00:00Z",
  };
  const repo = { ...defaults, ...overrides };
  db.prepare(`
    INSERT INTO starred_repos (
      id, name, full_name, description, url, homepage,
      stars, forks, watchers, language, owner_login, owner_avatar_url, owner_url,
      created_at, updated_at, starred_at
    ) VALUES (
      @id, @name, @full_name, @description, @url, @homepage,
      @stars, @forks, @watchers, @language, @owner_login, @owner_avatar_url, @owner_url,
      @created_at, @updated_at, @starred_at
    )
  `).run(repo);
  return repo;
}

describe("Database schema", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("creates all expected tables", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("trending_repos");
    expect(tableNames).toContain("trending_repo_topics");
    expect(tableNames).toContain("starred_repos");
    expect(tableNames).toContain("starred_repo_topics");
    expect(tableNames).toContain("trending_snapshots");
  });

  it("enforces period CHECK constraint", () => {
    expect(() =>
      insertTrendingRepo(db, { period: "invalid" }),
    ).toThrow();
  });
});

describe("Trending queries", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    insertTrendingRepo(db, {
      id: "t1",
      github_repo_id: 1,
      full_name: "user/repo1",
      name: "repo1",
      stars: 100,
      language: "TypeScript",
      snapshot_date: "2024-01-01",
    });
    insertTrendingRepo(db, {
      id: "t2",
      github_repo_id: 2,
      full_name: "user/repo2",
      name: "repo2",
      stars: 200,
      language: "Python",
      snapshot_date: "2024-01-01",
    });
    insertTrendingRepo(db, {
      id: "t3",
      github_repo_id: 3,
      full_name: "user/repo3",
      name: "repo3",
      stars: 50,
      language: "TypeScript",
      snapshot_date: "2024-01-02",
    });
  });

  afterEach(() => {
    db.close();
  });

  it("counts distinct repos", () => {
    const { count } = db
      .prepare(
        "SELECT COUNT(DISTINCT github_repo_id) as count FROM trending_repos",
      )
      .get() as { count: number };
    expect(count).toBe(3);
  });

  it("filters by language", () => {
    const rows = db
      .prepare(
        "SELECT full_name FROM trending_repos WHERE language = ? ORDER BY stars ASC",
      )
      .all("TypeScript") as { full_name: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].full_name).toBe("user/repo3");
    expect(rows[1].full_name).toBe("user/repo1");
  });

  it("filters by snapshot_date", () => {
    const rows = db
      .prepare("SELECT full_name FROM trending_repos WHERE snapshot_date = ?")
      .all("2024-01-01") as { full_name: string }[];
    expect(rows).toHaveLength(2);
  });

  it("retrieves distinct snapshot dates in descending order", () => {
    const rows = db
      .prepare(
        "SELECT DISTINCT snapshot_date FROM trending_repos ORDER BY snapshot_date DESC",
      )
      .all() as { snapshot_date: string }[];
    expect(rows.map((r) => r.snapshot_date)).toEqual([
      "2024-01-02",
      "2024-01-01",
    ]);
  });
});

describe("Starred queries", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    insertStarredRepo(db, {
      id: 10,
      full_name: "user/s1",
      name: "s1",
      stars: 1000,
      language: "Go",
      starred_at: "2024-06-01T00:00:00Z",
    });
    insertStarredRepo(db, {
      id: 20,
      full_name: "user/s2",
      name: "s2",
      stars: 500,
      language: "Rust",
      starred_at: "2024-06-02T00:00:00Z",
    });
  });

  afterEach(() => {
    db.close();
  });

  it("counts starred repos", () => {
    const { count } = db
      .prepare("SELECT COUNT(*) as count FROM starred_repos")
      .get() as { count: number };
    expect(count).toBe(2);
  });

  it("filters by stars range", () => {
    const rows = db
      .prepare("SELECT full_name FROM starred_repos WHERE stars >= ? AND stars <= ?")
      .all(600, 1200) as { full_name: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe("user/s1");
  });

  it("gets latest starred_at", () => {
    const { starred_at } = db
      .prepare("SELECT MAX(starred_at) as starred_at FROM starred_repos")
      .get() as { starred_at: string };
    expect(starred_at).toBe("2024-06-02T00:00:00Z");
  });

  it("enforces unique full_name", () => {
    expect(() =>
      insertStarredRepo(db, { id: 30, full_name: "user/s1" }),
    ).toThrow();
  });
});

describe("Topics", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    const repo = insertTrendingRepo(db, { id: "t1", github_repo_id: 1 });
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO trending_repo_topics (repo_id, topic) VALUES (?, ?)",
    );
    stmt.run(repo.id, "react");
    stmt.run(repo.id, "frontend");
  });

  afterEach(() => {
    db.close();
  });

  it("retrieves topics for a repo", () => {
    const topics = db
      .prepare("SELECT topic FROM trending_repo_topics WHERE repo_id = ? ORDER BY topic")
      .all("t1") as { topic: string }[];
    expect(topics.map((t) => t.topic)).toEqual(["frontend", "react"]);
  });

  it("batch retrieves topics for multiple repos", () => {
    const repo2 = insertTrendingRepo(db, { id: "t2", github_repo_id: 2 });
    db.prepare(
      "INSERT OR IGNORE INTO trending_repo_topics (repo_id, topic) VALUES (?, ?)",
    ).run(repo2.id, "backend");

    const rows = db
      .prepare(
        "SELECT repo_id, topic FROM trending_repo_topics WHERE repo_id IN (?, ?) ORDER BY topic",
      )
      .all("t1", "t2") as { repo_id: string; topic: string }[];
    expect(rows).toHaveLength(3);
  });
});
