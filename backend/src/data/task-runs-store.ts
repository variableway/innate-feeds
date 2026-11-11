/**
 * 后台任务运行记录 + 调度配置的 JSON 存储（issue #70）。
 *
 * 落盘位置：`$INNATE_HOME/admin/tasks/`（默认 `~/.innate/admin/tasks/`）：
 *   - runs.json        运行记录（最新在前，保留 MAX_RUNS 条）
 *   - schedules.json   每个 job 的定时配置
 *   - logs/<runId>.log 运行日志（stdout + stderr 合并）
 *
 * 注意：INNATE_HOME 在调用时读取（非模块加载时），以便测试重定向目录。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

export type TaskRunStatus =
  "running" | "success" | "failed" | "cancelled" | "interrupted";

export type TaskRunTrigger = "manual" | "schedule";

export interface TaskRun {
  id: string;
  jobId: string;
  status: TaskRunStatus;
  trigger: TaskRunTrigger;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  /** 日志文件绝对路径 */
  logFile: string;
}

export interface JobSchedule {
  jobId: string;
  enabled: boolean;
  /** 运行间隔（分钟）。5 ~ 10080（一周）。 */
  everyMinutes: number;
  /** 最近一次启动时间（任意 trigger），用于到期判断。 */
  lastStartedAt?: string;
}

const MAX_RUNS = 200;
const MAX_LOG_READ_BYTES = 200 * 1024;

export function getTasksStoreDir(): string {
  const innateHome =
    process.env.INNATE_HOME?.trim() || join(homedir(), ".innate");
  return join(innateHome, "admin", "tasks");
}

function runsPath(): string {
  return join(getTasksStoreDir(), "runs.json");
}

function schedulesPath(): string {
  return join(getTasksStoreDir(), "schedules.json");
}

function logsDir(): string {
  return join(getTasksStoreDir(), "logs");
}

export function getRunLogPath(runId: string): string {
  return join(logsDir(), `${runId}.log`);
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    console.warn(`Corrupt JSON store at ${path}, treating as empty`);
    return fallback;
  }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

export function newRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

function loadRuns(): TaskRun[] {
  const data = readJson<{ runs?: TaskRun[] }>(runsPath(), {});
  return Array.isArray(data.runs) ? data.runs : [];
}

function saveRuns(runs: TaskRun[]): void {
  writeJson(runsPath(), { runs });
}

/** 全部运行记录，最新在前。 */
export function listRuns(): TaskRun[] {
  return loadRuns();
}

export function getRun(runId: string): TaskRun | null {
  return loadRuns().find((r) => r.id === runId) ?? null;
}

export function addRun(run: TaskRun): void {
  const runs = loadRuns();
  runs.unshift(run);
  saveRuns(runs.slice(0, MAX_RUNS));
}

export function updateRun(
  runId: string,
  patch: Partial<Omit<TaskRun, "id">>,
): TaskRun | null {
  const runs = loadRuns();
  const run = runs.find((r) => r.id === runId);
  if (!run) return null;
  Object.assign(run, patch);
  saveRuns(runs);
  return run;
}

/**
 * 进程已不存在的 "running" 记录标为 "interrupted"（服务重启后遗留）。
 * 由 task-scheduler 启动时调用一次。
 */
export function markInterruptedRuns(): number {
  const runs = loadRuns();
  let changed = 0;
  for (const run of runs) {
    if (run.status === "running") {
      run.status = "interrupted";
      run.finishedAt = run.finishedAt ?? new Date().toISOString();
      changed++;
    }
  }
  if (changed) saveRuns(runs);
  return changed;
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export function appendRunLog(runId: string, text: string): void {
  mkdirSync(logsDir(), { recursive: true });
  appendFileSync(getRunLogPath(runId), text, "utf8");
}

/** 读取运行日志尾部（最多 MAX_LOG_READ_BYTES），供 UI 展示。 */
export function readRunLogTail(runId: string): string {
  const path = getRunLogPath(runId);
  if (!existsSync(path)) return "";
  const size = statSync(path).size;
  const start = Math.max(0, size - MAX_LOG_READ_BYTES);
  const length = size - start;
  if (length <= 0) return "";
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, start);
    const text = buffer.toString("utf8");
    return start > 0 ? `…（前 ${start} 字节省略）\n${text}` : text;
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

function loadSchedules(): JobSchedule[] {
  const data = readJson<{ schedules?: JobSchedule[] }>(schedulesPath(), {});
  return Array.isArray(data.schedules) ? data.schedules : [];
}

function saveSchedules(schedules: JobSchedule[]): void {
  writeJson(schedulesPath(), { schedules });
}

export function listSchedules(): JobSchedule[] {
  return loadSchedules();
}

export function getSchedule(jobId: string): JobSchedule | null {
  return loadSchedules().find((s) => s.jobId === jobId) ?? null;
}

/** 新增或更新调度配置（按 jobId 合并）。 */
export function upsertSchedule(
  jobId: string,
  patch: Partial<Omit<JobSchedule, "jobId">>,
): JobSchedule {
  const schedules = loadSchedules();
  let schedule = schedules.find((s) => s.jobId === jobId);
  if (!schedule) {
    schedule = { jobId, enabled: false, everyMinutes: 60 };
    schedules.push(schedule);
  }
  Object.assign(schedule, patch);
  saveSchedules(schedules);
  return schedule;
}
