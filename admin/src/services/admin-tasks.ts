/**
 * 采集任务后台 API 客户端（`/api/admin/tasks/*`，issue #70）。
 * API-mode only：后台管理依赖本地 Hono 后端，不做 static 模式降级。
 */

import type {
  AdminTaskJob,
  JobSchedule,
  RunDetail,
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

export function fetchJobs(): Promise<{ jobs: AdminTaskJob[] }> {
  return request("/jobs");
}

export function runJob(jobId: string): Promise<{ run: TaskRun }> {
  return request(`/jobs/${encodeURIComponent(jobId)}/run`, {
    method: "POST",
  });
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
