import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { dirname, isAbsolute, join, normalize, resolve } from "path";
import { fileURLToPath } from "url";

const CONFIG_FILENAME = "innate-feeds.config.json";
/** Web and unset desktop both persist under the project-relative `./readmes`. */
export const DEFAULT_READMES_DIR = "./readmes";

/** Monorepo root (`innate-feeds/`), derived from this file's location. */
export function getProjectRoot(): string {
  if (process.env.INNATE_PROJECT_ROOT?.trim()) {
    return resolve(process.env.INNATE_PROJECT_ROOT.trim());
  }
  // backend/src/data → ../../..
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../..");
}

export interface AppConfig {
  /** README cache directory: relative to project root, or absolute. */
  readmesDir: string;
}

export interface AppSettingsDTO {
  readmesDir: string;
  readmesDirResolved: string;
  /** Documented on-disk layout under the configured root. */
  filenameScheme: "{owner}/{repo}.md";
  projectRoot: string;
  configPath: string;
}

function configPath(): string {
  return join(getProjectRoot(), CONFIG_FILENAME);
}

function defaultConfig(): AppConfig {
  return { readmesDir: DEFAULT_READMES_DIR };
}

export function readAppConfig(): AppConfig {
  const path = configPath();
  if (!existsSync(path)) {
    return defaultConfig();
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as Partial<AppConfig>;
    const readmesDir =
      typeof raw.readmesDir === "string" && raw.readmesDir.trim()
        ? raw.readmesDir.trim()
        : DEFAULT_READMES_DIR;
    return { readmesDir };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[app-config] failed to read ${path}: ${msg}; using defaults`);
    return defaultConfig();
  }
}

export function writeAppConfig(patch: Partial<AppConfig>): AppConfig {
  const next: AppConfig = {
    ...readAppConfig(),
    ...patch,
  };
  if (typeof next.readmesDir !== "string" || !next.readmesDir.trim()) {
    throw Object.assign(new Error("readmesDir must be a non-empty string"), {
      status: 400,
    });
  }
  next.readmesDir = next.readmesDir.trim();
  const path = configPath();
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  return next;
}

/**
 * Resolve configured readmes directory to an absolute path.
 * Relative paths are resolved against the project root (not cwd).
 * Env `READMES_DIR` overrides config when set.
 */
export function resolveReadmesRoot(): string {
  const fromEnv = process.env.READMES_DIR?.trim();
  const configured = fromEnv || readAppConfig().readmesDir;
  const absolute = isAbsolute(configured)
    ? normalize(configured)
    : resolve(getProjectRoot(), configured);
  mkdirSync(absolute, { recursive: true });
  return absolute;
}

export function getAppSettings(): AppSettingsDTO {
  const cfg = readAppConfig();
  const root = resolveReadmesRoot();
  return {
    readmesDir: process.env.READMES_DIR?.trim() || cfg.readmesDir,
    readmesDirResolved: root,
    filenameScheme: "{owner}/{repo}.md",
    projectRoot: getProjectRoot(),
    configPath: configPath(),
  };
}
