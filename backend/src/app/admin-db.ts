import { mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { extname, join, resolve } from "path";
import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { getDefaultDbPath, INNATE_HOME } from "../db/paths.js";
import { ensureAdminSavedQueries } from "../data/admin-saved-queries.js";

/**
 * Simplified SQLite admin workspace API (`/api/admin/db/*`).
 *
 * Design constraints (see tasks/sprint-1/task-03-admin-api.md):
 * - User SQL runs on a dedicated READONLY connection, so writes to the feed
 *   database are impossible regardless of statement validation.
 * - Only a single SELECT/WITH statement is accepted (no multi-statements).
 * - Results are capped (truncated flag) so a runaway query cannot flood the UI.
 * - Saved queries live in `admin_saved_queries` in the main (writable) DB.
 * - JSON file querying uses a TEMP `json_documents` registry on the readonly
 *   connection (research: tasks/sprint-1/research/json-query.md).
 */

const DEFAULT_ROW_LIMIT = 500;
const MAX_SAVED_QUERIES = 200;
const JSON_FILE_MAX_BYTES = 1024 * 1024;

// ---------------------------------------------------------------------------
// Read-only statement validation (defense in depth; the readonly connection
// is the hard guarantee).
// ---------------------------------------------------------------------------

/** Strip `--` line comments and slash-star block comments so keyword checks see real SQL. */
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Validate that `sql` is a single read-only SELECT/WITH statement.
 * Returns an error message, or null when acceptable.
 */
export function validateReadOnlySql(rawSql: string): string | null {
  const sql = rawSql.trim();
  if (!sql) return "SQL is empty";

  const stripped = stripSqlComments(sql).trim();
  if (!stripped) return "SQL is empty (comments only)";

  // Reject trailing delimiter + any further statement separators.
  const withoutTrailing = stripped.replace(/;+\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return "Only a single statement is allowed";
  }

  const firstWord = withoutTrailing.split(/\s+/)[0]?.toUpperCase();
  if (firstWord !== "SELECT" && firstWord !== "WITH") {
    return "Only SELECT / WITH statements are allowed";
  }

  // Belt-and-braces: these never appear in legitimate read-only queries.
  const forbidden =
    /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|REPLACE|GRANT|REVOKE)\b/i;
  if (forbidden.test(withoutTrailing)) {
    return "Write / schema / pragma statements are not allowed";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Readonly connection (lazy, one per process)
// ---------------------------------------------------------------------------

let readonlyDb: Database | null = null;

function getReadonlyDb(): Database {
  if (!readonlyDb) {
    const path = getDefaultDbPath();
    readonlyDb = new Database(path, { readonly: true, create: false });
    // TEMP tables (json_documents registry) live in the temp store, which is
    // writable even on a readonly main database.
    readonlyDb.exec(
      `CREATE TEMP TABLE IF NOT EXISTS json_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        content TEXT NOT NULL
      )`,
    );
  }
  return readonlyDb;
}

// ---------------------------------------------------------------------------
// Introspection helpers
// ---------------------------------------------------------------------------

interface TableInfo {
  name: string;
  rowCount: number;
  kind: "table" | "view";
  internal: boolean;
}

/** FTS5 shadow tables (x_data / x_idx / x_content / x_docsize / x_config). */
function isFtsShadowTable(name: string): boolean {
  return /_(data|idx|content|docsize|config)$/.test(name);
}

function listTables(db: Database): TableInfo[] {
  const rows = db
    .query(
      `SELECT name, type FROM sqlite_master
       WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all() as { name: string; type: string }[];
  return rows.map(({ name, type }) => {
    const rowCount = (
      db
        .query(`SELECT COUNT(*) AS n FROM "${name.replaceAll('"', '""')}"`)
        .get() as {
        n: number;
      }
    ).n;
    return {
      name,
      rowCount,
      kind: type === "view" ? "view" : "table",
      internal: isFtsShadowTable(name),
    };
  });
}

function resolveTableName(db: Database, requested: string): string | null {
  // Whitelist against sqlite_master — never interpolate raw input into PRAGMA.
  const row = db
    .query(
      `SELECT name FROM sqlite_master
       WHERE type IN ('table','view') AND name = ?`,
    )
    .get(requested) as { name: string } | null;
  return row?.name ?? null;
}

// ---------------------------------------------------------------------------
// JSON file registry (tasks/sprint-1/research/json-query.md, 方案 A)
// ---------------------------------------------------------------------------

export function getJsonScanRoot(): string {
  return process.env.ADMIN_JSON_DIR?.trim()
    ? resolve(process.env.ADMIN_JSON_DIR.trim())
    : INNATE_HOME;
}

const JSON_SCAN_SKIP_DIRS = new Set([
  "node_modules",
  "secrets",
  "readmes",
  ".git",
]);

function scanJsonFiles(
  db: Database,
  root: string,
): { fileCount: number; totalBytes: number; skipped: number } {
  const files: { path: string; name: string; size: number }[] = [];
  let skipped = 0;

  const walk = (dir: string, depth: number): void => {
    if (depth > 6) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!JSON_SCAN_SKIP_DIRS.has(entry)) walk(full, depth + 1);
        continue;
      }
      if (extname(entry).toLowerCase() !== ".json") continue;
      if (st.size > JSON_FILE_MAX_BYTES || st.size === 0) {
        skipped++;
        continue;
      }
      files.push({ path: full, name: entry, size: st.size });
    }
  };

  walk(root, 0);

  db.exec("DELETE FROM json_documents");
  const insert = db.query(
    "INSERT INTO json_documents (path, name, size, content) VALUES (?, ?, ?, ?)",
  );
  let totalBytes = 0;
  for (const file of files) {
    try {
      const content = readFileSync(file.path, "utf8");
      insert.run(file.path, file.name, file.size, content);
      totalBytes += file.size;
    } catch {
      skipped++;
    }
  }
  return { fileCount: files.length, totalBytes, skipped };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const adminDbRouter = new Hono();

/** List user tables + row counts. */
adminDbRouter.get("/api/admin/db/tables", (c) => {
  try {
    return c.json({ tables: listTables(getReadonlyDb()) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database unavailable";
    return c.json({ error: message }, 503);
  }
});

/** Columns + indexes + DDL for one table. */
adminDbRouter.get("/api/admin/db/tables/:name/schema", (c) => {
  try {
    const db = getReadonlyDb();
    const name = resolveTableName(db, c.req.param("name"));
    if (!name) {
      return c.json({ error: `Unknown table: ${c.req.param("name")}` }, 404);
    }
    const quoted = `"${name.replaceAll('"', '""')}"`;
    const columns = db.query(`PRAGMA table_info(${quoted})`).all() as Record<
      string,
      unknown
    >[];
    const indexes = (
      db.query(`PRAGMA index_list(${quoted})`).all() as {
        name: string;
        unique: number;
        origin: string;
      }[]
    ).map((idx) => ({
      ...idx,
      columns: (
        db
          .query(`PRAGMA index_info("${idx.name.replaceAll('"', '""')}")`)
          .all() as {
          name: string | null;
        }[]
      ).map((col) => col.name),
    }));
    const ddl = (
      db.query(`SELECT sql FROM sqlite_master WHERE name = ?`).get(name) as {
        sql: string | null;
      }
    ).sql;
    return c.json({ table: name, columns, indexes, ddl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Introspection failed";
    return c.json({ error: message }, 500);
  }
});

const QUERY_BODY_SCHEMA = z.object({ sql: z.string().min(1) });

/** Execute a single read-only statement, returning a table-shaped result. */
adminDbRouter.post("/api/admin/db/query", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = QUERY_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Body must be { sql: string }" }, 400);
  }

  const violation = validateReadOnlySql(parsed.data.sql);
  if (violation) {
    return c.json({ error: violation }, 400);
  }

  try {
    const db = getReadonlyDb();
    const started = performance.now();
    const stmt = db.prepare(parsed.data.sql);
    const rows = stmt.all() as Record<string, unknown>[];
    const durationMs = Math.round((performance.now() - started) * 100) / 100;
    const columns =
      rows.length > 0
        ? Object.keys(rows[0])
        : (
            (stmt as unknown as { columns?: { name: string }[] }).columns ?? []
          ).map((col) => col.name);
    const truncated = rows.length > DEFAULT_ROW_LIMIT;
    return c.json({
      columns,
      rows: truncated ? rows.slice(0, DEFAULT_ROW_LIMIT) : rows,
      rowCount: rows.length,
      truncated,
      rowLimit: DEFAULT_ROW_LIMIT,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return c.json({ error: message }, 400);
  }
});

// Saved queries ---------------------------------------------------------------

const SAVED_QUERY_BODY_SCHEMA = z.object({
  name: z.string().min(1).max(120),
  sql: z.string().min(1),
  description: z.string().max(500).optional(),
});

adminDbRouter.get("/api/admin/db/queries", (c) => {
  try {
    ensureAdminSavedQueries(getDb());
    const rows = getDb()
      .query(
        `SELECT id, name, sql, description, created_at AS createdAt, updated_at AS updatedAt
         FROM admin_saved_queries ORDER BY updated_at DESC, id DESC`,
      )
      .all();
    return c.json({ queries: rows });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list queries";
    return c.json({ error: message }, 500);
  }
});

adminDbRouter.post("/api/admin/db/queries", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = SAVED_QUERY_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Body must be { name, sql, description? }" }, 400);
  }
  const count = (
    getDb().query("SELECT COUNT(*) AS n FROM admin_saved_queries").get() as {
      n: number;
    }
  ).n;
  if (count >= MAX_SAVED_QUERIES) {
    return c.json({ error: "Saved query limit reached" }, 409);
  }
  const { name, sql, description } = parsed.data;
  const result = getDb()
    .query(
      `INSERT INTO admin_saved_queries (name, sql, description)
       VALUES (?, ?, ?)`,
    )
    .run(name, sql, description ?? null);
  const row = getDb()
    .query(
      `SELECT id, name, sql, description, created_at AS createdAt, updated_at AS updatedAt
       FROM admin_saved_queries WHERE id = ?`,
    )
    .get(result.lastInsertRowid);
  return c.json({ query: row }, 201);
});

adminDbRouter.put("/api/admin/db/queries/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = SAVED_QUERY_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Body must be { name, sql, description? }" }, 400);
  }
  const { name, sql, description } = parsed.data;
  const result = getDb()
    .query(
      `UPDATE admin_saved_queries
       SET name = ?, sql = ?, description = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(name, sql, description ?? null, id);
  if (result.changes === 0) {
    return c.json({ error: "Saved query not found" }, 404);
  }
  const row = getDb()
    .query(
      `SELECT id, name, sql, description, created_at AS createdAt, updated_at AS updatedAt
       FROM admin_saved_queries WHERE id = ?`,
    )
    .get(id);
  return c.json({ query: row });
});

adminDbRouter.delete("/api/admin/db/queries/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const result = getDb()
    .query("DELETE FROM admin_saved_queries WHERE id = ?")
    .run(id);
  if (result.changes === 0) {
    return c.json({ error: "Saved query not found" }, 404);
  }
  return c.json({ ok: true });
});

// JSON file registry ------------------------------------------------------------

adminDbRouter.get("/api/admin/db/json/files", (c) => {
  try {
    const db = getReadonlyDb();
    const files = db
      .query(
        `SELECT id, path, name, size,
                json_valid(content) AS valid
         FROM json_documents ORDER BY path`,
      )
      .all();
    return c.json({ root: getJsonScanRoot(), files });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Scan registry unavailable";
    return c.json({ error: message }, 503);
  }
});

/** Rebuild the json_documents registry from the configured scan root. */
adminDbRouter.post("/api/admin/db/json/scan", (c) => {
  try {
    const root = getJsonScanRoot();
    mkdirSync(root, { recursive: true });
    const stats = scanJsonFiles(getReadonlyDb(), root);
    return c.json({ root, ...stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "JSON scan failed";
    return c.json({ error: message }, 500);
  }
});
