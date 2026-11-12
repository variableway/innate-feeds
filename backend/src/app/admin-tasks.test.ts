/**
 * `/api/admin/tasks/*` 的路由级测试（issue #70 增补：批量启动）。
 *
 * 只覆盖**不产生子进程**的分支：元信息、参数校验、未知 job。真实启动
 * 由 `run-batch` 的端到端手测覆盖（见 docs/arch-design/admin-scheduled-tasks.md）。
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { adminTasksRouter } from "./admin-tasks.js";
import { closeDb } from "../db/index.js";

let tempHome: string;
let prevHome: string | undefined;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "innate-admin-tasks-test-"));
  prevHome = process.env.INNATE_HOME;
  process.env.INNATE_HOME = tempHome;
});

afterEach(() => {
  closeDb();
  if (prevHome === undefined) delete process.env.INNATE_HOME;
  else process.env.INNATE_HOME = prevHome;
  try {
    rmSync(tempHome, { recursive: true, force: true });
  } catch {
    // Windows 上 bun:sqlite 的 Statement 在 close 后仍可能持有文件句柄（EBUSY），
    // 临时目录交给系统清理；测试结果不受影响。
  }
});

async function postBatch(body: unknown): Promise<Response> {
  return adminTasksRouter.request("/api/admin/tasks/jobs/run-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin tasks API", () => {
  test("GET /jobs exposes registry plus concurrency metadata", async () => {
    const res = await adminTasksRouter.request("/api/admin/tasks/jobs");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      jobs: Array<{ id: string; tags: Array<{ slug: string }> }>;
      tags: Array<{ slug: string; count: number }>;
      runningCount: number;
      maxConcurrent: number;
    };
    expect(body.jobs.length).toBeGreaterThan(0);
    expect(body.runningCount).toBe(0);
    expect(body.maxConcurrent).toBeGreaterThan(0);
    // DB 标签字典：github / dsh / topics / news
    expect(body.tags.map((tag) => tag.slug)).toEqual([
      "github",
      "dsh",
      "topics",
      "news",
    ]);
    const hackernews = body.jobs.find((job) => job.id === "hackernews");
    expect(hackernews?.tags.map((tag) => tag.slug)).toEqual(["news"]);
  });

  test("POST /jobs/run-batch rejects an unknown tag", async () => {
    const res = await postBatch({ tag: "__missing__" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Unknown tag");
  });

  test("PUT /jobs/:id/tags persists overrides in SQLite", async () => {
    const res = await adminTasksRouter.request(
      "/api/admin/tasks/jobs/hackernews/tags",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["github", "news"] }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobId: string; tags: string[] };
    expect(body.tags).toEqual(["github", "news"]);

    const jobsRes = await adminTasksRouter.request("/api/admin/tasks/jobs");
    const jobsBody = (await jobsRes.json()) as {
      jobs: Array<{
        id: string;
        tags: Array<{ slug: string; label: string }>;
      }>;
    };
    expect(jobsBody.jobs.find((job) => job.id === "hackernews")?.tags).toEqual([
      { slug: "github", label: "GitHub" },
      { slug: "news", label: "News" },
    ]);
  });

  test("PUT /jobs/:id/tags rejects unknown tags", async () => {
    const res = await adminTasksRouter.request(
      "/api/admin/tasks/jobs/hackernews/tags",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["nope"] }),
      },
    );
    expect(res.status).toBe(400);
  });

  test("POST /jobs/run-batch rejects an empty body", async () => {
    const res = await postBatch({});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("jobIds");
  });

  test("POST /jobs/run-batch reports unknown jobs without starting runs", async () => {
    const res = await postBatch({ jobIds: ["__missing__"] });
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      started: number;
      results: Array<{ jobId: string; error?: string }>;
    };
    expect(body.started).toBe(0);
    expect(body.results).toEqual([
      { jobId: "__missing__", error: "Unknown job: __missing__" },
    ]);
  });
});
