import type { Database } from "bun:sqlite";

/**
 * Saved SQL queries for the admin workspace (`/api/admin/db/queries`).
 * Lives in the main (writable) database; created alongside the core schema.
 *
 * Example seeds come from the R1 similarity-query research
 * (tasks/sprint-1/research/similarity-query.md).
 */
const SEED_EXAMPLES: { name: string; description: string; sql: string }[] = [
  {
    name: "AI Agent · stars > 10000（topic LIKE 兜底）",
    description: "推荐：覆盖 ai-agent / ai-agents / *-agent 等所有含 agent 的 topic",
    sql: `SELECT s.full_name, s.stars, s.language,
       GROUP_CONCAT(t.topic) AS topics
FROM starred_repos s
JOIN starred_repo_topics t ON t.repo_id = s.id
WHERE t.topic LIKE '%agent%'
  AND s.stars > 10000
GROUP BY s.id
ORDER BY s.stars DESC`,
  },
  {
    name: "AI Agent · 精确 topic 白名单",
    description: "严格版：只匹配人工确认的 AI Agent topic 集合",
    sql: `SELECT s.full_name, s.stars, s.language,
       GROUP_CONCAT(t.topic) AS topics
FROM starred_repos s
JOIN starred_repo_topics t ON t.repo_id = s.id
WHERE t.topic IN ('ai-agent','ai-agents','agent','agents',
                  'agentic-ai','agentic','llm-agent','multi-agent',
                  'autonomous-agents','coding-agent','agent-framework')
  AND s.stars > 10000
GROUP BY s.id
ORDER BY s.stars DESC`,
  },
  {
    name: "agent 关键词 · FTS5 BM25 相关性",
    description: "名称/描述模糊匹配 + BM25 排序（相似度检索）",
    sql: `SELECT starred_repos.full_name, starred_repos.stars,
       starred_repos.description,
       bm25(starred_repos_fts) AS rank
FROM starred_repos_fts
JOIN starred_repos ON starred_repos.rowid = starred_repos_fts.rowid
WHERE starred_repos_fts MATCH 'agent'
  AND starred_repos.stars > 10000
ORDER BY rank
LIMIT 50`,
  },
  {
    name: "JSON 文件 · json_each 展开",
    description: "先执行 POST /api/admin/db/json/scan，再用本查询按行展开任意 JSON 内容",
    sql: `SELECT jd.name, je.key, je.type,
       CASE WHEN json_type(je.value) IN ('object','array')
            THEN substr(je.value, 1, 120) ELSE je.value END AS value
FROM json_documents jd, json_each(jd.content) je
LIMIT 200`,
  },
];

/** Create the table when missing and seed examples into an empty table. */
export function ensureAdminSavedQueries(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS admin_saved_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sql TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const count = (
    db.query("SELECT COUNT(*) AS n FROM admin_saved_queries").get() as {
      n: number;
    }
  ).n;
  if (count === 0) {
    const insert = db.query(
      "INSERT INTO admin_saved_queries (name, sql, description) VALUES (?, ?, ?)",
    );
    for (const example of SEED_EXAMPLES) {
      insert.run(example.name, example.sql, example.description);
    }
  }
}
