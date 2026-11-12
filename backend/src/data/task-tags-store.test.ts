/**
 * 任务标签存储测试：空库播种、job↔tag 映射、覆盖式更新与幂等性。
 * 用 `:memory:` 数据库避免碰 INNATE_HOME 下的真实文件。
 */
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import schemaSql from "../db/schema.sql" with { type: "text" };
import { SYNC_JOBS } from "../collectors/jobs.js";
import {
  DEFAULT_JOB_TAGS,
  ensureTaskTagSeed,
  listJobTags,
  listTaskTags,
  setJobTags,
} from "./task-tags-store.js";

function createDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(schemaSql);
  return db;
}

describe("task-tags-store", () => {
  test("seeds the four default tags with per-tag job counts", () => {
    const db = createDb();
    const tags = listTaskTags(db);
    expect(tags.map((tag) => tag.slug)).toEqual([
      "github",
      "dsh",
      "topics",
      "news",
    ]);
    expect(tags.map((tag) => tag.count)).toEqual([8, 1, 4, 8]);
    expect(tags.reduce((sum, tag) => sum + tag.count, 0)).toBe(
      SYNC_JOBS.length,
    );
    db.close();
  });

  test("maps every registered job to at least one tag", () => {
    const db = createDb();
    const jobTags = listJobTags(db);
    for (const job of SYNC_JOBS) {
      expect(jobTags.get(job.id)?.length ?? 0).toBeGreaterThan(0);
    }
    expect(jobTags.get("hackernews")).toEqual(["news"]);
    expect(jobTags.get("awesome-dsh")).toEqual(["dsh"]);
    expect(jobTags.get("github-topics")).toEqual(["topics"]);
    expect(jobTags.get("trending-daily")).toEqual(["github"]);
    db.close();
  });

  test("seeding is idempotent after tags are edited", () => {
    const db = createDb();
    setJobTags("hackernews", ["github", "news"], db);
    // 再走一次播种：task_job_tags 非空，不应覆盖手工改动。
    ensureTaskTagSeed(db);
    expect(listJobTags(db).get("hackernews")).toEqual(["github", "news"]);
    expect(listTaskTags(db).find((tag) => tag.slug === "github")?.count).toBe(
      9,
    );
    db.close();
  });

  test("setJobTags replaces the previous assignment and rejects unknown tags", () => {
    const db = createDb();
    setJobTags("awesome-dsh", [], db);
    expect(listJobTags(db).get("awesome-dsh")).toBeUndefined();

    setJobTags("awesome-dsh", ["topics"], db);
    expect(listJobTags(db).get("awesome-dsh")).toEqual(["topics"]);

    expect(() => setJobTags("awesome-dsh", ["nope"], db)).toThrow(
      "Unknown tag: nope",
    );
    db.close();
  });

  test("default mapping covers all registered job ids", () => {
    const ids = new Set(SYNC_JOBS.map((job) => job.id));
    for (const jobId of Object.keys(DEFAULT_JOB_TAGS)) {
      expect(ids.has(jobId)).toBe(true);
    }
  });
});
