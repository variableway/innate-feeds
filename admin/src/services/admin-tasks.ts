/**
 * 采集任务后台 API 客户端（`/api/admin/tasks/*`，issue #70）。
 * API-mode only：后台管理依赖本地 Hono 后端，不做 static 模式降级。
 */

import type {
  BatchRunResponse,
  JobSchedule,
  JobsResponse,
  RunDetail,
  SyncJobGroup,
  TaskRun,
} from "@/types/tasks";

const API_BASE = "/api/admin/tasks";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const data = (await res.json().catch(() => null)) as
    (T & { error?: string }) | null;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function fetchJobs(): Promise<JobsResponse> {
  return request("/jobs");
}

export function runJob(jobId: string): Promise<{ run: TaskRun }> {
  return request(`/jobs/${encodeURIComponent(jobId)}/run`, {
    method: "POST",
  });
}

/**
 * 批量/一键启动：按 jobIds 或注册表分组。
 * 全部未启动时后端返回 409 + results（每个 job 的跳过原因），这里保留该结构。
 */
export async function runJobs(body: {
  jobIds?: string[];
  group?: SyncJobGroup;
}): Promise<BatchRunResponse> {
  const res = await fetch(`${API_BASE}/jobs/run-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as
    (BatchRunResponse & { error?: string }) | null;
  if (!res.ok && !data?.results) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as BatchRunResponse;
}

export function fetchRuns(options?: {
  jobId?: string;
  limit?: number;
}): Promise<{ runs: TaskRun[] }> {
  const params = new URLSearchParams();
  if (options?.jobId) params.set("jobId", options.jobId);
  if (options?.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  return request(`/runs${qs ? `?${qs}` : ""}`);
}

export function fetchRunDetail(runId: string): Promise<RunDetail> {
  return request(`/runs/${encodeURIComponent(runId)}`);
}

export function cancelRun(runId: string): Promise<{ ok: boolean }> {
  return request(`/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
  });
}

export function fetchSchedules(): Promise<{ schedules: JobSchedule[] }> {
  return request("/schedules");
}

export function saveSchedule(
  jobId: string,
  body: { enabled: boolean; everyMinutes: number },
): Promise<{ schedule: JobSchedule }> {
  return request(`/schedules/${encodeURIComponent(jobId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function clearSchedule(jobId: string): Promise<{ ok: boolean }> {
  return request(`/schedules/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
  });
}
