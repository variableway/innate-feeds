import type {
  DshPlugin,
  PluginCategoryStat,
  PluginSearchResult,
  PluginStats,
} from "@/types/plugin";

const API_BASE = "/api";

export interface PluginQuery {
  q?: string;
  category?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export async function fetchPluginStats(): Promise<PluginStats> {
  const res = await fetch(`${API_BASE}/plugins/stats`);
  if (!res.ok) throw new Error("Failed to load plugin stats");
  return res.json();
}

export async function fetchPluginCategories(): Promise<PluginCategoryStat[]> {
  const res = await fetch(`${API_BASE}/plugins/categories`);
  if (!res.ok) throw new Error("Failed to load plugin categories");
  return res.json();
}

export async function fetchPlugins(
  query: PluginQuery,
): Promise<PluginSearchResult> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.sort) params.set("sort", query.sort);
  if (query.page) params.set("page", String(query.page));
  if (query.perPage) params.set("perPage", String(query.perPage));
  const res = await fetch(`${API_BASE}/plugins?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load plugins");
  return res.json();
}

export async function fetchPlugin(slug: string): Promise<DshPlugin | null> {
  const res = await fetch(`${API_BASE}/plugins/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load plugin");
  return res.json();
}

export async function fetchRelatedPlugins(slug: string): Promise<DshPlugin[]> {
  const res = await fetch(
    `${API_BASE}/plugins/${encodeURIComponent(slug)}/related`,
  );
  if (!res.ok) return [];
  return res.json();
}
