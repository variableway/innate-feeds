import type {
  DshPlugin,
  PluginCategoryStat,
  PluginSearchResult,
  PluginStats,
} from "@/types/plugin";
import { PLUGIN_CATEGORIES } from "@innate/shared/plugin-categories";

const API_BASE = "/api";

const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");
const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";

export interface PluginQuery {
  q?: string;
  category?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

// --- Static mode: load the exported plugin catalog once and mirror the
// backend's search/filter/sort/pagination on the client. ---

let staticPlugins: Promise<DshPlugin[]> | null = null;

function loadStaticPlugins(): Promise<DshPlugin[]> {
  if (!staticPlugins) {
    staticPlugins = fetch(`${STATIC_BASE}/plugins.json`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load plugin catalog");
        return res.json() as Promise<{ plugins: DshPlugin[] }>;
      })
      .then((data) => data.plugins ?? []);
  }
  return staticPlugins;
}

function searchStaticPlugins(
  plugins: DshPlugin[],
  query: PluginQuery,
): PluginSearchResult {
  const q = (query.q ?? "").trim().toLowerCase();
  let items = plugins;
  if (query.category) {
    items = items.filter((plugin) => plugin.bundleCategory === query.category);
  }
  if (q) {
    items = items.filter((plugin) => {
      const hay =
        `${plugin.name} ${plugin.tagline} ${plugin.taglineZh ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const sort = query.sort ?? "stars.desc";
  items = [...items].sort((a, b) => {
    switch (sort) {
      case "stars.asc":
        return a.stars - b.stars || a.name.localeCompare(b.name);
      case "added.desc":
        return (
          (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
          b.stars - a.stars
        );
      case "added.asc":
        return (
          (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "") ||
          b.stars - a.stars
        );
      case "name.asc":
        return a.name.localeCompare(b.name);
      case "name.desc":
        return b.name.localeCompare(a.name);
      case "stars.desc":
      default:
        return b.stars - a.stars || a.name.localeCompare(b.name);
    }
  });

  const perPage = Math.min(100, Math.max(1, query.perPage ?? 35));
  const page = Math.max(1, query.page ?? 1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    total,
    page,
    perPage,
    pageCount,
  };
}

// --- Public API (identical signatures for API and static modes) ---

export async function fetchPluginStats(): Promise<PluginStats> {
  if (IS_STATIC) {
    const plugins = await loadStaticPlugins();
    return { total: plugins.length, categories: PLUGIN_CATEGORIES.length };
  }
  const res = await fetch(`${API_BASE}/plugins/stats`);
  if (!res.ok) throw new Error("Failed to load plugin stats");
  return res.json();
}

export async function fetchPluginCategories(): Promise<PluginCategoryStat[]> {
  if (IS_STATIC) {
    const plugins = await loadStaticPlugins();
    const counts = new Map<string, number>();
    for (const plugin of plugins) {
      counts.set(
        plugin.bundleCategory,
        (counts.get(plugin.bundleCategory) ?? 0) + 1,
      );
    }
    return PLUGIN_CATEGORIES.map((category) => ({
      ...category,
      count: counts.get(category.id) ?? 0,
    }));
  }
  const res = await fetch(`${API_BASE}/plugins/categories`);
  if (!res.ok) throw new Error("Failed to load plugin categories");
  return res.json();
}

export async function fetchPlugins(
  query: PluginQuery,
): Promise<PluginSearchResult> {
  if (IS_STATIC) {
    const plugins = await loadStaticPlugins();
    return searchStaticPlugins(plugins, query);
  }
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
  if (IS_STATIC) {
    const plugins = await loadStaticPlugins();
    return plugins.find((plugin) => plugin.slug === slug) ?? null;
  }
  const res = await fetch(`${API_BASE}/plugins/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load plugin");
  return res.json();
}

export async function fetchRelatedPlugins(slug: string): Promise<DshPlugin[]> {
  if (IS_STATIC) {
    const plugins = await loadStaticPlugins();
    const plugin = plugins.find((item) => item.slug === slug);
    if (!plugin) return [];
    return plugins
      .filter(
        (item) =>
          item.bundleCategory === plugin.bundleCategory &&
          item.slug !== plugin.slug,
      )
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 6);
  }
  const res = await fetch(
    `${API_BASE}/plugins/${encodeURIComponent(slug)}/related`,
  );
  if (!res.ok) return [];
  return res.json();
}
