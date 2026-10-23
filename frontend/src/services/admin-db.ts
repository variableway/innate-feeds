/**
 * Admin workspace API client (`/api/admin/db/*`, backend/src/app/admin-db.ts).
 * API-mode only: the static (GitHub Pages) deployment has no database to query.
 */

const API_BASE = "/api/admin/db";

export interface AdminDbTable {
  name: string;
  rowCount: number;
  kind: "table" | "view";
  internal: boolean;
}

export interface AdminDbColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface AdminDbIndex {
  name: string;
  unique: number;
  origin: string;
  columns: (string | null)[];
}

export interface AdminDbTableSchema {
  table: string;
  columns: AdminDbColumn[];
  indexes: AdminDbIndex[];
  ddl: string | null;
}

export interface AdminDbQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  rowLimit: number;
  durationMs: number;
}

export interface AdminDbSavedQuery {
  id: number;
  name: string;
  sql: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDbJsonFile {
  id: number;
  path: string;
  name: string;
  size: number;
  valid: number;
}

export interface AdminDbJsonScanResult {
  root: string;
  fileCount: number;
  totalBytes: number;
  skipped: number;
}

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

export function fetchAdminTables(): Promise<{ tables: AdminDbTable[] }> {
  return request("/tables");
}

export function fetchTableSchema(name: string): Promise<AdminDbTableSchema> {
  return request(`/tables/${encodeURIComponent(name)}/schema`);
}

export function runAdminQuery(sql: string): Promise<AdminDbQueryResult> {
  return request("/query", { method: "POST", body: JSON.stringify({ sql }) });
}

export function fetchSavedQueries(): Promise<{
  queries: AdminDbSavedQuery[];
}> {
  return request("/queries");
}

export function createSavedQuery(body: {
  name: string;
  sql: string;
  description?: string;
}): Promise<{ query: AdminDbSavedQuery }> {
  return request("/queries", { method: "POST", body: JSON.stringify(body) });
}

export function updateSavedQuery(
  id: number,
  body: { name: string; sql: string; description?: string },
): Promise<{ query: AdminDbSavedQuery }> {
  return request(`/queries/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteSavedQuery(id: number): Promise<{ ok: boolean }> {
  return request(`/queries/${id}`, { method: "DELETE" });
}

export function scanJsonFiles(): Promise<AdminDbJsonScanResult> {
  return request("/json/scan", { method: "POST" });
}

export function fetchJsonFiles(): Promise<{
  root: string;
  files: AdminDbJsonFile[];
}> {
  return request("/json/files");
}
