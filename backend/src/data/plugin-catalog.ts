import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { load as yamlLoad } from "js-yaml";
import { getProjectRoot } from "./app-config.js";
import {
  PLUGIN_CATEGORIES,
  PLUGIN_CATEGORY_IDS,
  pluginCategoryById,
  type PluginCategoryId,
} from "../../../shared/plugin-categories.js";

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

interface YamlEntry {
  url?: unknown;
  name?: unknown;
  category?: unknown;
  description?: { en?: unknown; zh?: unknown };
  tarball?: unknown;
  npm?: unknown;
}

type StarsMap = Record<string, { stars?: number }>;
type ScreenshotsMap = Record<string, string[]>;
type DatesMap = Record<string, string>;

let cache: DshPlugin[] | null = null;

function dataDir(): string {
  if (process.env.DSH_PLUGIN_DATA_DIR?.trim()) {
    return resolve(process.env.DSH_PLUGIN_DATA_DIR.trim());
  }
  return resolve(getProjectRoot(), "../awesome/awesome-dsh-plugin/data");
}

function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.yml$/, "")
    .toLowerCase()
    .replace(/__/g, "-")
    .replace(/--/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseGithubUrl(url: string): {
  owner: string;
  repo: string;
  sub: string | null;
} {
  const p = url.replace(/^https:\/\/github\.com\//, "").replace(/\/+$/, "");
  const [owner, repo, ...rest] = p.split("/");
  const sub =
    rest[0] === "tree" ? rest.slice(2).join("/") || null : rest.join("/") || null;
  return { owner: owner ?? "", repo: repo ?? "", sub };
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return {} as T;
  }
}

function buildContent(
  entry: YamlEntry & { url: string },
  installCommand: string,
  screenshots: string[],
): string {
  const lines: string[] = [
    "## Install",
    "",
    "```sh",
    installCommand,
    "```",
    "",
  ];
  if (typeof entry.npm === "string") {
    lines.push(
      `Also available as the npm package [\`${entry.npm}\`](https://www.npmjs.com/package/${entry.npm}).`,
      "",
    );
  }
  if (typeof entry.tarball === "string") {
    lines.push(`Prebuilt release tarball: [download](${entry.tarball}).`, "");
  }
  lines.push(`Source: [${entry.url}](${entry.url})`, "");
  if (screenshots.length > 0) {
    lines.push("## Screenshots", "");
    for (const shot of screenshots) lines.push(`![screenshot](${shot})`, "");
  }
  lines.push(
    "---",
    "",
    "> Installing a plugin runs third-party code with your own permissions. Review the source before you install.",
  );
  return lines.join("\n");
}

function loadAll(): DshPlugin[] {
  const root = dataDir();
  const yamlDir = join(root, "plugins");
  const stars = readJson<StarsMap>(join(root, "stars.json"));
  const screenshotsMap = readJson<ScreenshotsMap>(join(root, "screenshots.json"));
  const dates = readJson<DatesMap>(join(root, "added-dates.json"));

  let names: string[] = [];
  try {
    names = readdirSync(yamlDir)
      .filter((file) => file.endsWith(".yml"))
      .sort();
  } catch (err) {
    console.warn(
      `DSH plugin data not found at ${yamlDir}:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }

  const plugins: DshPlugin[] = [];
  for (const file of names) {
    let parsed: YamlEntry;
    try {
      parsed = yamlLoad(readFileSync(join(yamlDir, file), "utf8")) as YamlEntry;
    } catch {
      continue;
    }
    if (
      typeof parsed.url !== "string" ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(parsed.url)
    ) {
      continue;
    }
    if (typeof parsed.name !== "string" || !parsed.name.trim()) continue;
    if (!PLUGIN_CATEGORY_IDS.includes(parsed.category as PluginCategoryId)) {
      continue;
    }
    const descEn = parsed.description?.en;
    if (typeof descEn !== "string" || !descEn.trim()) continue;

    const { owner, repo, sub } = parseGithubUrl(parsed.url);
    const slug = slugFromFilename(file);
    const category = parsed.category as PluginCategoryId;
    const meta = pluginCategoryById(category)!;
    const installCommand = `dsh plugin --profile web add github:${owner}/${repo}${sub ? `#path:/${sub}` : ""}`;
    const starCount =
      stars[parsed.url]?.stars ??
      stars[`https://github.com/${owner}/${repo}`]?.stars ??
      0;
    const shots =
      screenshotsMap[parsed.url] ??
      screenshotsMap[`https://github.com/${owner}/${repo}`] ??
      [];
    const added =
      dates[parsed.url] ?? dates[`https://github.com/${owner}/${repo}`];
    const publishedAt = added ? new Date(added) : null;
    const descZh = parsed.description?.zh;

    plugins.push({
      slug,
      name: parsed.name,
      tagline: descEn,
      taglineZh:
        typeof descZh === "string" && descZh.trim() ? descZh : null,
      description: descEn,
      content: buildContent(
        parsed as YamlEntry & { url: string },
        installCommand,
        shots,
      ),
      stars: starCount,
      screenshotUrl: shots[0] ?? null,
      screenshots: shots.slice(1),
      bundleCategory: category,
      bundleCategoryZh: meta.labelZh,
      repositoryUrl: parsed.url,
      websiteUrl: `https://github.com/${owner}/${repo}`,
      installCommand,
      npmPackage: typeof parsed.npm === "string" ? parsed.npm : null,
      tarballUrl: typeof parsed.tarball === "string" ? parsed.tarball : null,
      publishedAt:
        publishedAt && !Number.isNaN(publishedAt.getTime())
          ? publishedAt.toISOString()
          : null,
    });
  }
  return plugins;
}

export function getPlugins(): DshPlugin[] {
  if (!cache) cache = loadAll();
  return cache;
}

export function getPluginStats() {
  const plugins = getPlugins();
  return {
    total: plugins.length,
    categories: PLUGIN_CATEGORIES.length,
    dataDir: dataDir(),
  };
}

export function getPluginCategories() {
  const plugins = getPlugins();
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

export function findPlugin(slug: string): DshPlugin | undefined {
  return getPlugins().find((plugin) => plugin.slug === slug);
}

export function findRelatedPlugins(plugin: DshPlugin, take = 6): DshPlugin[] {
  return getPlugins()
    .filter(
      (item) =>
        item.bundleCategory === plugin.bundleCategory && item.slug !== plugin.slug,
    )
    .sort((a, b) => b.stars - a.stars)
    .slice(0, take);
}

export interface PluginSearchInput {
  q?: string;
  category?: string[];
  sort?: string;
  page?: number;
  perPage?: number;
}

export function searchPlugins(input: PluginSearchInput) {
  const q = (input.q ?? "").trim().toLowerCase();
  const categories = input.category?.filter(Boolean) ?? [];
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(100, Math.max(1, input.perPage ?? 35));

  let items = getPlugins();
  if (categories.length > 0) {
    const set = new Set(categories);
    items = items.filter((plugin) => set.has(plugin.bundleCategory));
  }
  if (q) {
    items = items.filter((plugin) => {
      const hay = `${plugin.name} ${plugin.tagline} ${plugin.taglineZh ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const sort = input.sort ?? "stars.desc";
  items = [...items].sort((a, b) => {
    switch (sort) {
      case "stars.asc":
        return a.stars - b.stars || a.name.localeCompare(b.name);
      case "added.desc":
        return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || b.stars - a.stars;
      case "added.asc":
        return (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "") || b.stars - a.stars;
      case "name.asc":
        return a.name.localeCompare(b.name);
      case "name.desc":
        return b.name.localeCompare(a.name);
      case "stars.desc":
      default:
        return b.stars - a.stars || a.name.localeCompare(b.name);
    }
  });

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
