/**
 * 采集任务标签存储（issue #70 跟进）——分组从代码常量迁到 SQLite。
 *
 * 表结构（backend/src/db/schema.sql）：
 *   - `task_tags`      标签字典：slug / label / sort_order
 *   - `task_job_tags`  job_id ↔ tag_id 多对多（job_id = SYNC_JOBS.id）
 *
 * 首次读取时按 DEFAULT_JOB_TAGS 播种四个标签（github / dsh / topics / news）；
 * 之后**以库为准**：直接改 `task_job_tags`（后台 SQLite 工作台）即可调整分组，
 * 播种逻辑只在 `task_tags` / `task_job_tags` 为空时执行，不会覆盖手工修改。
 */
import { Database } from "bun:sqlite";
import { SYNC_JOBS } from "../collectors/jobs.js";
import { getDb } from "../db/index.js";

export interface TaskTag {
  slug: string;
  label: string;
  /** 展示顺序（越小越前） */
  sortOrder: number;
}

export interface TaskTagWithCount extends TaskTag {
  /** 挂在该标签下的任务数 */
  count: number;
}

export const DEFAULT_TASK_TAGS: TaskTag[] = [
  { slug: "github", label: "GitHub", sortOrder: 10 },
  { slug: "dsh", label: "DSH", sortOrder: 20 },
  { slug: "topics", label: "Topics", sortOrder: 30 },
  { slug: "news", label: "News", sortOrder: 40 },
];

/**
 * 默认 job→tag 映射（每个任务一个主标签，多标签模型已支持）。
 * 仅作首次播种；后续以数据库为准。
 */
export const DEFAULT_JOB_TAGS: Record<string, string[]> = {
  // GitHub 系
  "trending-daily": ["github"],
  "trending-all": ["github"],
  "starred-recent": ["github"],
  digest: ["github"],
  trendshift: ["github"],
  "github-new": ["github"],
  hot: ["github"],
  window: ["github"],
  // DSH 目录
  "awesome-dsh": ["dsh"],
  // 垂直 topic 源
  "github-topics": ["topics"],
  "edu-skills": ["topics"],
  "edu-videos": ["topics"],
  "edu-videos-bilibili": ["topics"],
  // 资讯 / 外部源
  producthunt: ["news"],
  yc: ["news"],
  a16z: ["news"],
  hackernews: ["news"],
  huggingface: ["news"],
  devto: ["news"],
  lobsters: ["news"],
  "vc-external": ["news"],
};

function countRows(db: Database, table: string): number {
  const row = db.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
    count: number;
  };
  return row.count;
}

/** 空库时播种默认标签与 job 映射（幂等，不覆盖已有数据）。 */
export function ensureTaskTagSeed(db: Database = getDb()): void {
  if (countRows(db, "task_tags") === 0) {
    const insertTag = db.prepare(
      "INSERT INTO task_tags (slug, label, sort_order) VALUES (?, ?, ?)",
    );
    db.transaction(() => {
      for (const tag of DEFAULT_TASK_TAGS) {
        insertTag.run(tag.slug, tag.label, tag.sortOrder);
      }
    })();
  }

  if (countRows(db, "task_job_tags") === 0) {
    const knownJobs = new Set(SYNC_JOBS.map((job) => job.id));
    const insertLink = db.prepare(
      "INSERT OR IGNORE INTO task_job_tags (job_id, tag_id) SELECT ?, id FROM task_tags WHERE slug = ?",
    );
    db.transaction(() => {
      for (const [jobId, slugs] of Object.entries(DEFAULT_JOB_TAGS)) {
        if (!knownJobs.has(jobId)) continue;
        for (const slug of slugs) insertLink.run(jobId, slug);
      }
    })();
  }
}

/** 标签字典 + 每个标签下的任务数。 */
export function listTaskTags(db: Database = getDb()): TaskTagWithCount[] {
  ensureTaskTagSeed(db);
  return db
    .query(
      `SELECT t.slug AS slug, t.label AS label, t.sort_order AS sortOrder,
              COUNT(j.job_id) AS count
         FROM task_tags t
         LEFT JOIN task_job_tags j ON j.tag_id = t.id
        GROUP BY t.id
        ORDER BY t.sort_order, t.slug`,
    )
    .all() as TaskTagWithCount[];
}

/** 全部 job 的标签映射（jobId → slug[]）。 */
export function listJobTags(db: Database = getDb()): Map<string, string[]> {
  ensureTaskTagSeed(db);
  const rows = db
    .query(
      `SELECT j.job_id AS jobId, t.slug AS slug
         FROM task_job_tags j
         JOIN task_tags t ON t.id = j.tag_id
        ORDER BY t.sort_order, t.slug`,
    )
    .all() as Array<{ jobId: string; slug: string }>;
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const slugs = map.get(row.jobId) ?? [];
    slugs.push(row.slug);
    map.set(row.jobId, slugs);
  }
  return map;
}

/** 单个 job 的标签（未分组返回空数组）。 */
export function getJobTags(jobId: string, db: Database = getDb()): string[] {
  ensureTaskTagSeed(db);
  const rows = db
    .query(
      `SELECT t.slug AS slug
         FROM task_job_tags j
         JOIN task_tags t ON t.id = j.tag_id
        WHERE j.job_id = ?
        ORDER BY t.sort_order, t.slug`,
    )
    .all(jobId) as Array<{ slug: string }>;
  return rows.map((row) => row.slug);
}

/**
 * 覆盖式设置某个 job 的标签（事务内先删后插）。
 * 未知 slug 直接抛错，避免静默丢标签。
 */
export function setJobTags(
  jobId: string,
  slugs: string[],
  db: Database = getDb(),
): string[] {
  ensureTaskTagSeed(db);
  const normalized = [
    ...new Set(slugs.map((slug) => slug.trim()).filter(Boolean)),
  ];
  const known = listTaskTags(db).map((tag) => tag.slug);
  const unknown = normalized.filter((slug) => !known.includes(slug));
  if (unknown.length > 0) {
    throw new Error(`Unknown tag: ${unknown.join(", ")}`);
  }

  const insertLink = db.prepare(
    "INSERT OR IGNORE INTO task_job_tags (job_id, tag_id) SELECT ?, id FROM task_tags WHERE slug = ?",
  );
  db.transaction(() => {
    db.prepare("DELETE FROM task_job_tags WHERE job_id = ?").run(jobId);
    for (const slug of normalized) insertLink.run(jobId, slug);
  })();
  return normalized;
}
