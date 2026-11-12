/**
 * 后台任务 API（issue #70）：`/api/admin/tasks/*`。
 *
 * 把 M-Sync 采集任务可视化成后台任务：
 *   - jobs 列表（来自 collectors/jobs.ts 注册表）+ 最近运行状态
 *   - 手动触发运行 / 取消运行
 *   - 运行历史 + 日志
 *   - 定时调度配置（定时自动运行）
 *
 * 运行与调度逻辑在 task-runner.ts（子进程执行，不进 API 进程内采集）。
 */
import { Hono } from "hono";
import { z } from "zod";
import { SYNC_JOBS, findSyncJob } from "../collectors/jobs.js";
import {
  getRun,
  listRuns,
  listSchedules,
  readRunLogTail,
  upsertSchedule,
  type TaskRun,
} from "../data/task-runs-store.js";
import {
  cancelJobRun,
  getRunningCount,
  getRunningRunId,
  MAX_CONCURRENT_RUNS,
  isJobRunning,
  startJobRun,
} from "./task-runner.js";

const SCHEDULE_BODY_SCHEMA = z.object({
  enabled: z.boolean(),
  everyMinutes: z
    .number()
    .int()
    .min(5, "间隔最少 5 分钟")
    .max(10080, "间隔最多 7 天"),
});

/** 批量启动：显式 jobIds，或按注册表分组取全部。 */
const BATCH_RUN_BODY_SCHEMA = z
  .object({
    jobIds: z.array(z.string().min(1)).max(100).optional(),
    group: z
      .enum(["core", "external", "topics", "vertical", "pipeline"])
      .optional(),
  })
  .refine(
    (body) => body.group !== undefined || (body.jobIds?.length ?? 0) > 0,
    {
      message: "jobIds 或 group 至少提供一个",
    },
  );

function runSummary(run: TaskRun | null | undefined) {
  return run ?? null;
}

export const adminTasksRouter = new Hono();

/** GET /api/admin/tasks/jobs — 注册表 + 运行状态 + 调度配置。 */
adminTasksRouter.get("/api/admin/tasks/jobs", (c) => {
  const runs = listRuns();
  const schedules = new Map(listSchedules().map((s) => [s.jobId, s]));
  const jobs = SYNC_JOBS.map((job) => {
    const lastRun = runs.find((r) => r.jobId === job.id) ?? null;
    return {
      ...job,
      running: isJobRunning(job.id),
      runningRunId: getRunningRunId(job.id),
      lastRun: runSummary(lastRun),
      schedule: schedules.get(job.id) ?? null,
    };
  });
  return c.json({
    jobs,
    runningCount: getRunningCount(),
    maxConcurrent: MAX_CONCURRENT_RUNS,
  });
});

/**
 * POST /api/admin/tasks/jobs/run-batch — 批量/一键启动。
 * 按 jobIds 或注册表分组依次发起；每个 job 独立记录结果，已运行/未知/超并发
 * 都只体现在该条目上，不影响其它 job。
 */
adminTasksRouter.post("/api/admin/tasks/jobs/run-batch", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = BATCH_RUN_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid batch body" },
      400,
    );
  }

  const targets = new Map<string, (typeof SYNC_JOBS)[number]>();
  if (parsed.data.group) {
    for (const job of SYNC_JOBS) {
      if (job.group === parsed.data.group) targets.set(job.id, job);
    }
  }
  for (const jobId of parsed.data.jobIds ?? []) {
    const job = findSyncJob(jobId);
    if (job) targets.set(job.id, job);
  }

  const results: Array<{
    jobId: string;
    run?: TaskRun;
    error?: string;
  }> = [];
  for (const jobId of parsed.data.jobIds ?? []) {
    if (!findSyncJob(jobId)) {
      results.push({ jobId, error: `Unknown job: ${jobId}` });
    }
  }
  for (const job of targets.values()) {
    const started = startJobRun(job.id, "manual");
    results.push(
      started.run
        ? { jobId: job.id, run: started.run }
        : { jobId: job.id, error: started.error ?? "Failed to start run" },
    );
  }

  const startedCount = results.filter((result) => result.run).length;
  return c.json(
    { results, started: startedCount },
    startedCount > 0 ? 201 : 409,
  );
});

/** POST /api/admin/tasks/jobs/:id/run — 手动触发一次后台运行。 */
adminTasksRouter.post("/api/admin/tasks/jobs/:id/run", (c) => {
  const jobId = c.req.param("id");
  if (!findSyncJob(jobId)) {
    return c.json({ error: `Unknown job: ${jobId}` }, 404);
  }
  const result = startJobRun(jobId, "manual");
  if (!result.run) {
    return c.json({ error: result.error ?? "Failed to start run" }, 409);
  }
  return c.json({ run: result.run }, 201);
});

/** GET /api/admin/tasks/runs — 运行历史（可按 job 过滤）。 */
adminTasksRouter.get("/api/admin/tasks/runs", (c) => {
  const jobId = c.req.query("jobId");
  let runs = listRuns();
  if (jobId) runs = runs.filter((r) => r.jobId === jobId);
  const limit = Math.min(
    200,
    Math.max(1, Number(c.req.query("limit") ?? 50) || 50),
  );
  return c.json({ runs: runs.slice(0, limit) });
});

/** GET /api/admin/tasks/runs/:runId — 运行详情 + 日志尾部。 */
adminTasksRouter.get("/api/admin/tasks/runs/:runId", (c) => {
  const run = getRun(c.req.param("runId"));
  if (!run) return c.json({ error: "Run not found" }, 404);
  return c.json({ run, log: readRunLogTail(run.id) });
});

/** POST /api/admin/tasks/runs/:runId/cancel — 取消运行中的任务。 */
adminTasksRouter.post("/api/admin/tasks/runs/:runId/cancel", (c) => {
  const runId = c.req.param("runId");
  const run = getRun(runId);
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (!cancelJobRun(runId)) {
    return c.json({ error: "Run is not active" }, 409);
  }
  return c.json({ ok: true });
});

/** GET /api/admin/tasks/schedules — 全部调度配置。 */
adminTasksRouter.get("/api/admin/tasks/schedules", (c) => {
  return c.json({ schedules: listSchedules() });
});

/** PUT /api/admin/tasks/schedules/:jobId — 设置定时自动运行。 */
adminTasksRouter.put("/api/admin/tasks/schedules/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  if (!findSyncJob(jobId)) {
    return c.json({ error: `Unknown job: ${jobId}` }, 404);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = SCHEDULE_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid schedule body" },
      400,
    );
  }
  const schedule = upsertSchedule(jobId, parsed.data);
  return c.json({ schedule });
});

/** DELETE /api/admin/tasks/schedules/:jobId — 清除调度配置。 */
adminTasksRouter.delete("/api/admin/tasks/schedules/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  upsertSchedule(jobId, { enabled: false });
  return c.json({ ok: true });
});
