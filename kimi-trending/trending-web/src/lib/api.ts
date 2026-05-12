import {
  mockTrendingRepos,
  mockStarredRepos,
  mockProductHuntItems,
  mockStats,
  mockLanguages,
} from '@/lib/mock';
import type { GitHubTrending, GitHubStarred, ProductHunt, DashboardStats, ApiResponse } from '@/types';

// ============================================================
// API Client — supports multiple data sources:
//  1. Static JSON files (public/data/*.json) — daily auto-update
//  2. Hard-coded mock data — fallback
//  3. Real backend API — when deployed with Go backend
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
// Default to mock mode unless explicitly disabled
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// ---- Helpers ----

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => [k, String(v)]);
  return new URLSearchParams(entries).toString();
}

/** Fetch JSON from /data/*.json (used in auto-update mode) */
async function fetchJson<T>(filename: string): Promise<T> {
  const res = await fetch(`/data/${filename}.json`);
  if (!res.ok) throw new Error(`Failed to load ${filename}: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Decide whether to use static JSON, mock data, or real API */
async function resolveData<T>(
  jsonFile: string,
  mockData: T,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Try static JSON files (from daily auto-update)
  try {
    return await fetchJson<T>(jsonFile);
  } catch {
    // 2. Use mock data as fallback
    console.log(`[api] ${jsonFile}.json not found, using mock data`);
    return mockData;
  }
}

// ---- Trending ----

export interface TrendingParams {
  period?: string;
  language?: string;
  limit?: number;
  offset?: number;
}

async function getTrending(params: TrendingParams): Promise<ApiResponse<GitHubTrending>> {
  const all = await resolveData<ApiResponse<GitHubTrending>>(
    'trending',
    { data: mockTrendingRepos, total: mockTrendingRepos.length, limit: 100, offset: 0 },
    () => fetch(`${API_BASE}/github/trending?${qs(params)}`).then((r) => r.json())
  );

  let data = all.data;
  if (params.period) data = data.filter((r) => r.period === params.period);
  if (params.language) data = data.filter((r) => r.language === params.language);
  return { ...all, data, total: data.length };
}

async function getLanguages(): Promise<string[]> {
  try {
    return await fetchJson<string[]>('languages');
  } catch {
    return mockLanguages;
  }
}

async function fetchTrending(body: { period?: string; language?: string }) {
  return { status: 'ok', message: 'Data will refresh on next load', ...body };
}

// ---- Starred ----

export interface StarredParams {
  language?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

async function getStarred(username: string, params: StarredParams): Promise<ApiResponse<GitHubStarred>> {
  const data = mockStarredRepos;
  let filtered = [...data];
  if (params.language) filtered = filtered.filter((r) => r.language === params.language);
  return { data: filtered, total: filtered.length, limit: 100, offset: 0 };
}

async function fetchStarred(body: { username: string }) {
  return { status: 'ok', username: body.username };
}

async function getUserLanguages(username: string): Promise<Record<string, number>> {
  const data = mockStarredRepos;
  const map: Record<string, number> = {};
  data.forEach((r) => {
    if (r.language) map[r.language] = (map[r.language] || 0) + 1;
  });
  return map;
}

// ---- Product Hunt ----

export interface ProductHuntParams {
  day?: string;
  limit?: number;
  offset?: number;
}

async function getProductHunt(params: ProductHuntParams): Promise<ApiResponse<ProductHunt>> {
  return resolveData<ApiResponse<ProductHunt>>(
    'producthunt',
    { data: mockProductHuntItems, total: mockProductHuntItems.length, limit: 100, offset: 0 },
    () => fetch(`${API_BASE}/producthunt/trending?${qs(params)}`).then((r) => r.json())
  );
}

async function getCategories(): Promise<string[]> {
  // Extract unique topics from mock data
  const topics = new Set<string>();
  mockProductHuntItems.forEach((p) => {
    try {
      JSON.parse(p.topics || '[]').forEach((t: string) => topics.add(t));
    } catch { /* ignore */ }
  });
  return [...topics];
}

async function fetchProductHunt(body: { day?: string }) {
  return { status: 'ok', ...body };
}

// ---- Stats ----

async function getStats(): Promise<DashboardStats> {
  try {
    return await fetchJson<DashboardStats>('stats');
  } catch {
    return mockStats;
  }
}

// ---- Health ----

async function health(): Promise<{ status: string }> {
  return { status: 'ok' };
}

// ---- API Object ----

export const api = {
  // GitHub Trending
  getTrending,
  getLanguages,
  fetchTrending,

  // GitHub Starred
  getStarred,
  fetchStarred,
  getUserLanguages,

  // Product Hunt
  getProductHunt,
  getCategories,
  fetchProductHunt,

  // Stats
  getStats,

  // Health
  health,
};

// Export for debugging
export { USE_MOCK, API_BASE };
