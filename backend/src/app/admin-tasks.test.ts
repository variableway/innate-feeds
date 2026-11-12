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

let tempHome: string;
let prevHome: string | undefined;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "innate-admin-tasks-test-"));
  prevHome = process.env.INNATE_HOME;
  process.env.INNATE_HOME = tempHome;
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.INNATE_HOME;
  else process.env.INNATE_HOME = prevHome;
  rmSync(tempHome, { recursive: true, force: true });
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
      jobs: unknown[];
      runningCount: number;
      maxConcurrent: number;
    };
    expect(body.jobs.length).toBeGreaterThan(0);
    expect(body.runningCount).toBe(0);
    expect(body.maxConcurrent).toBeGreaterThan(0);
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
