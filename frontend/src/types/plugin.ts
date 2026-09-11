import type { PluginCategoryId } from "@innate/shared/plugin-categories";

export interface DshPlugin {
  slug: string;
  name: string;
  tagline: string;
  taglineZh: string | null;
  description: string;
  content: string;
  stars: number;
  screenshotUrl: string | null;
  screenshots: string[];
  bundleCategory: PluginCategoryId;
  bundleCategoryZh: string;
  repositoryUrl: string;
  websiteUrl: string;
  installCommand: string;
  npmPackage: string | null;
  tarballUrl: string | null;
  publishedAt: string | null;
}

export interface PluginSearchResult {
  items: DshPlugin[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export interface PluginCategoryStat {
  id: string;
  label: string;
  labelZh: string;
  emoji: string;
  count: number;
}

export interface PluginStats {
  total: number;
  categories: number;
}
