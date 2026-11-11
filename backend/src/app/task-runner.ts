/**
 * 后台任务运行器（issue #70）：把 M-Sync job 跑成可视化的后台任务。
 *
 * 每次运行 = 子进程 `bun src/app/cli.ts sync job <id>`（jobs.ts 注册表），
 * stdout/stderr 合并写入日志文件，运行记录落 task-runs-store。
 * 调度器按 schedules.json 的到期任务自动触发（trigger: "schedule"）。
 *
 * 注意：这是 M-API 例外的显式扩展——server.ts 只经由本模块启动子进程，
 * 不在 API 进程内直接调用 collectors 的写路径。
 */
import { spawn, type Subprocess } from "bun";
import { mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { findSyncJob } from "../collectors/jobs.js";
import {
  addRun,
  appendRunLog,
  getRunLogPath,
  listSchedules,
  markInterruptedRuns,
  newRunId,
  updateRun,
  upsertSchedule,
  type TaskRun,
  type TaskRunTrigger,
} from "../data/task-runs-store.js";

/** 本模块所在 backend 包根（src/app → backend/）。 */
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const runningProcesses = new Map<string, Subprocess>();
const runningByJob = new Map<string, string>();

export function isJobRunning(jobId: string): boolean {
  return runningByJob.has(jobId);
}

export function getRunningRunId(jobId: string): string | null {
  return runningByJob.get(jobId) ?? null;
}

export interface StartRunResult {
  run?: TaskRun;
  error?: string;
}

/** 启动一次后台运行（异步执行，立即返回运行记录）。 */
export function startJobRun(
  jobId: string,
  trigger: TaskRunTrigger,
): StartRunResult {
  const job = findSyncJob(jobId);
  if (!job) return { error: `Unknown job: ${jobId}` };
  if (runningByJob.has(jobId)) {
    return { error: `Job already running: ${jobId}` };
  }

  const runId = newRunId();
  const logFile = getRunLogPath(runId);
  mkdirSync(dirname(logFile), { recursive: true });

  const run: TaskRun = {
    id: runId,
    jobId,
    status: "running",
    trigger,
    startedAt: new Date().toISOString(),
    logFile,
  };
  addRun(run);
  upsertSchedule(jobId, { lastStartedAt: run.startedAt });

  const cmd = [
    process.execPath,
    join(backendRoot, "src", "app", "cli.ts"),
    "sync",
    "job",
    jobId,
  ];
  appendRunLog(runId, `$ ${cmd.join(" ")}\n`);

  let proc: Subprocess;
  try {
    proc = spawn({
      cmd,
      cwd: backendRoot,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });
  } catch (error) {
    updateRun(runId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      exitCode: null,
    });
    appendRunLog(runId, `\n[spawn failed] ${String(error)}\n`);
    return { error: `Spawn failed: ${String(error)}` };
  }

  runningProcesses.set(runId, proc);
  runningByJob.set(jobId, runId);

  void pipeOutput(runId, proc.stdout, proc.stderr).finally(async () => {
    let exitCode: number | null = null;
    try {
      exitCode = await proc.exited;
    } catch {
      exitCode = null;
    }
    const cancelled = !runningProcesses.has(runId);
    runningProcesses.delete(runId);
    if (runningByJob.get(jobId) === runId) runningByJob.delete(jobId);
    appendRunLog(runId, `\n[exit ${exitCode ?? "signal"}]\n`);
    updateRun(runId, {
      status: cancelled ? "cancelled" : exitCode === 0 ? "success" : "failed",
      finishedAt: new Date().toISOString(),
      exitCode,
    });
  });

  return { run };
}

async function pipeOutput(
  runId: string,
  stdout: ReadableStream<Uint8Array> | number | null | undefined,
  stderr: ReadableStream<Uint8Array> | number | null | undefined,
): Promise<void> {
  const decoder = new TextDecoder();
  async function pump(
    stream: ReadableStream<Uint8Array> | number | null | undefined,
  ): Promise<void> {
    if (!stream || typeof stream === "number") return;
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) appendRunLog(runId, decoder.decode(value, { stream: true }));
      }
    } catch {
      // 进程被 kill 时读流可能中断——日志到此为止即可。
    }
  }
  await Promise.all([pump(stdout), pump(stderr)]);
}

/** 取消运行中的任务（kill 子进程）。 */
export function cancelJobRun(runId: string): boolean {
  const proc = runningProcesses.get(runId);
  if (!proc) return false;
  runningProcesses.delete(runId);
  proc.kill();
  return true;
}

// ---------------------------------------------------------------------------
// Scheduler：每 tickSeconds 检查一次到期的调度任务
// ---------------------------------------------------------------------------

const TICK_MS = 30_000;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function isScheduleDue(
  schedule: { enabled: boolean; everyMinutes: number; lastStartedAt?: string },
  now: number,
): boolean {
  if (!schedule.enabled) return false;
  const last = schedule.lastStartedAt
    ? Date.parse(schedule.lastStartedAt)
    : NaN;
  if (Number.isNaN(last)) return true;
  return now - last >= schedule.everyMinutes * 60_000;
}

/** 启动调度器（幂等）。启动时把遗留 running 记录标记为 interrupted。 */
export function startTaskScheduler(): void {
  if (schedulerTimer) return;
  const interrupted = markInterruptedRuns();
  if (interrupted > 0) {
    console.log(`[tasks] marked ${interrupted} stale run(s) as interrupted`);
  }
  schedulerTimer = setInterval(() => {
    for (const schedule of listSchedules()) {
      if (!isScheduleDue(schedule, Date.now())) continue;
      if (!findSyncJob(schedule.jobId)) continue;
      const result = startJobRun(schedule.jobId, "schedule");
      if (result.run) {
        console.log(
          `[tasks] scheduled run ${result.run.id} for job ${schedule.jobId}`,
        );
      }
    }
  }, TICK_MS);
  // 不阻止进程退出（CLI 复用同一进程模型时）。
  schedulerTimer.unref?.();
  console.log("[tasks] scheduler started (tick 30s)");
}

export function stopTaskScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

/** 供 server.ts 启动日志用。 */
export function describeScheduler(): string {
  const enabled = listSchedules().filter((s) => s.enabled);
  return `${enabled.length} enabled / ${listSchedules().length} configured`;
}
