-- Trending repositories: completely separate storage from starred repos.
-- id is a composite key so the same GitHub repo can appear on different dates/periods.
CREATE TABLE IF NOT EXISTS trending_repos (
  id TEXT PRIMARY KEY,
  github_repo_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  homepage TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  watchers INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  owner_login TEXT NOT NULL,
  owner_avatar_url TEXT NOT NULL,
  owner_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly')),
  snapshot_date TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trending_repo_topics (
  repo_id TEXT NOT NULL REFERENCES trending_repos(id),
  topic TEXT NOT NULL,
  PRIMARY KEY (repo_id, topic)
);

-- Starred repositories: completely separate storage from trending repos.
CREATE TABLE IF NOT EXISTS starred_repos (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  description TEXT,
  url TEXT NOT NULL,
  homepage TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  watchers INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  owner_login TEXT NOT NULL,
  owner_avatar_url TEXT NOT NULL,
  owner_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  starred_at TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS starred_repo_topics (
  repo_id INTEGER NOT NULL REFERENCES starred_repos(id),
  topic TEXT NOT NULL,
  PRIMARY KEY (repo_id, topic)
);

-- Historical trending snapshots for analytics (currently unused by sync code).
CREATE TABLE IF NOT EXISTS trending_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly')),
  repo_id INTEGER NOT NULL,
  rank INTEGER,
  stars_at_time INTEGER NOT NULL,
  stars_gained INTEGER,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(snapshot_date, period, repo_id)
);

-- GitHub Hot (GH #63, M1 heat engine): one ranked snapshot per day.
-- heat = Σ per independent source weight × 2^(-hours since first_seen / 24),
-- rule version travels with every row (see backend/src/curation/heat.ts).
CREATE TABLE IF NOT EXISTS hot_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  full_name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  heat REAL NOT NULL,
  signals_json TEXT NOT NULL,
  stars INTEGER,
  stars_gained INTEGER,
  description TEXT,
  language TEXT,
  owner_login TEXT,
  owner_avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hot_snapshots_date ON hot_snapshots(snapshot_date, rank);

-- 采集任务标签（issue #70 跟进）：任务分组从代码常量迁到 SQLite。
-- task_tags 是标签字典（github / dsh / topics / news），task_job_tags 是
-- job_id ↔ tag 多对多映射；job_id 对应 collectors/jobs.ts 的 SYNC_JOBS.id。
-- 首次读取时按 DEFAULT_JOB_TAGS 播种，之后以库为准（可直接用 SQLite 工作台维护）。
CREATE TABLE IF NOT EXISTS task_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_job_tags (
  job_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES task_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_job_tags_tag ON task_job_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_trending_repos_language ON trending_repos(language);
CREATE INDEX IF NOT EXISTS idx_trending_repos_stars ON trending_repos(stars);
CREATE INDEX IF NOT EXISTS idx_trending_repos_snapshot_date ON trending_repos(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_trending_repos_period ON trending_repos(period);
CREATE INDEX IF NOT EXISTS idx_trending_repo_topics_topic ON trending_repo_topics(topic);

CREATE INDEX IF NOT EXISTS idx_starred_repos_language ON starred_repos(language);
CREATE INDEX IF NOT EXISTS idx_starred_repos_stars ON starred_repos(stars);
CREATE INDEX IF NOT EXISTS idx_starred_repo_topics_topic ON starred_repo_topics(topic);

CREATE INDEX IF NOT EXISTS idx_trending_snapshots_date ON trending_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_trending_snapshots_period ON trending_snapshots(period);

-- Full-text search (FTS5) mirrors for keyword search with BM25 ranking.
-- External-content tables: the text stays in the repo tables, triggers keep
-- the index in sync, and getDb() rebuilds both indexes on connection init so
-- databases written before FTS5 existed (or outside these triggers) are
-- backfilled automatically.
CREATE VIRTUAL TABLE IF NOT EXISTS trending_repos_fts USING fts5(
  name, full_name, description,
  content='trending_repos', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS trending_repos_fts_ai AFTER INSERT ON trending_repos BEGIN
  INSERT INTO trending_repos_fts(rowid, name, full_name, description)
  VALUES (new.rowid, new.name, new.full_name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS trending_repos_fts_ad AFTER DELETE ON trending_repos BEGIN
  INSERT INTO trending_repos_fts(trending_repos_fts, rowid, name, full_name, description)
  VALUES ('delete', old.rowid, old.name, old.full_name, old.description);
END;
CREATE TRIGGER IF NOT EXISTS trending_repos_fts_au AFTER UPDATE ON trending_repos BEGIN
  INSERT INTO trending_repos_fts(trending_repos_fts, rowid, name, full_name, description)
  VALUES ('delete', old.rowid, old.name, old.full_name, old.description);
  INSERT INTO trending_repos_fts(rowid, name, full_name, description)
  VALUES (new.rowid, new.name, new.full_name, new.description);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS starred_repos_fts USING fts5(
  name, full_name, description,
  content='starred_repos', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS starred_repos_fts_ai AFTER INSERT ON starred_repos BEGIN
  INSERT INTO starred_repos_fts(rowid, name, full_name, description)
  VALUES (new.rowid, new.name, new.full_name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS starred_repos_fts_ad AFTER DELETE ON starred_repos BEGIN
  INSERT INTO starred_repos_fts(starred_repos_fts, rowid, name, full_name, description)
  VALUES ('delete', old.rowid, old.name, old.full_name, old.description);
END;
CREATE TRIGGER IF NOT EXISTS starred_repos_fts_au AFTER UPDATE ON starred_repos BEGIN
  INSERT INTO starred_repos_fts(starred_repos_fts, rowid, name, full_name, description)
  VALUES ('delete', old.rowid, old.name, old.full_name, old.description);
  INSERT INTO starred_repos_fts(rowid, name, full_name, description)
  VALUES (new.rowid, new.name, new.full_name, new.description);
END;
