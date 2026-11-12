/**
 * 采集任务后台的 wire 类型（issue #70）。
 * 与 backend/src/app/admin-tasks.ts 的响应形状一一对应；
 * job 注册表字段来自 backend/src/collectors/jobs.ts（SYNC_JOBS）。
 */

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
  logFile: string;
}

export interface JobSchedule {
  jobId: string;
  enabled: boolean;
  /** 运行间隔（分钟）。5 ~ 10080（一周）。 */
  everyMinutes: number;
  lastStartedAt?: string;
}

export type SyncJobGroup =
  "core" | "external" | "topics" | "vertical" | "pipeline";

/** 任务标签（DB 驱动，见 backend/src/data/task-tags-store.ts）。 */
export interface AdminTaskTag {
  slug: string;
  label: string;
}

/** 标签字典项 + 挂载任务数（GET /jobs 的 `tags`）。 */
export interface TaskTagSummary extends AdminTaskTag {
  sortOrder: number;
  count: number;
}

export interface AdminTaskJob {
  id: string;
  group: SyncJobGroup;
  summary: string;
  args: string[];
  outputs: string;
  running: boolean;
  runningRunId: string | null;
  lastRun: TaskRun | null;
  schedule: JobSchedule | null;
  /** DB 中该任务的标签（多标签，按 sort_order 排序） */
  tags: AdminTaskTag[];
}

export interface JobsResponse {
  jobs: AdminTaskJob[];
  /** 标签字典 + 每标签任务数 */
  tags: TaskTagSummary[];
  /** 当前运行中的子进程数 */
  runningCount: number;
  /** 全局并发上限（后端 MAX_CONCURRENT_RUNS） */
  maxConcurrent: number;
}

/** 批量启动的单 job 结果：run 与 error 二选一。 */
export interface BatchRunResult {
  jobId: string;
  run?: TaskRun;
  error?: string;
}

export interface BatchRunResponse {
  results: BatchRunResult[];
  started: number;
}

export interface RunDetail {
  run: TaskRun;
  /** 日志尾部（≤200KB） */
  log: string;
}
