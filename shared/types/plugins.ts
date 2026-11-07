/**
 * DSH plugin catalog contract (S0).
 * 单一真相：后端 dsh/catalog.ts 与 topics/dsh/src/types/plugin.ts 均 re-export。
 */
import type { PluginCategoryId } from "../plugin-categories.js";

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
  /** Stars 刷新时间（market catalog 产出；legacy YAML 回退路径为空串） */
  starsUpdatedAt: string;
  /** Per-plugin page on the upstream market site (market catalog only). */
  upstreamUrl?: string | null;
}
