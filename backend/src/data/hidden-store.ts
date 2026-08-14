import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getDefaultDbPath } from "../db/paths.js";

export type HiddenKind = "digest" | "repo";

interface HiddenData {
  digest: string[];
  repos: string[];
}

function hiddenPath(): string {
  // Keep next to the database so DB_PATH / INNATE_HOME moves it along.
  return join(dirname(getDefaultDbPath()), "hidden.json");
}

/** Absolute path of the hidden store file (may not exist yet). */
export function getHiddenFilePath(): string {
  return hiddenPath();
}

function readHidden(): HiddenData {
  const path = hiddenPath();
  if (!existsSync(path)) {
    return { digest: [], repos: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<HiddenData>;
    return {
      digest: Array.isArray(raw.digest) ? raw.digest.filter(Boolean) : [],
      repos: Array.isArray(raw.repos) ? raw.repos.filter(Boolean) : [],
    };
  } catch {
    console.warn(`Corrupt hidden store at ${path}, treating as empty`);
    return { digest: [], repos: [] };
  }
}

function writeHidden(data: HiddenData): void {
  const path = hiddenPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/** Hidden digest item ids (e.g. "digest-ruanyf-weekly-123456789"). */
export function getHiddenDigestIds(): Set<string> {
  return new Set(readHidden().digest);
}

/** Hidden repo full names, lowercased (e.g. "owner/repo"). */
export function getHiddenRepoFullNames(): Set<string> {
  return new Set(readHidden().repos);
}

export function hideItem(kind: HiddenKind, id: string): void {
  const data = readHidden();
  const key = kind === "repo" ? id.trim().toLowerCase() : id.trim();
  if (!key) return;
  const list = kind === "repo" ? data.repos : data.digest;
  if (!list.includes(key)) {
    list.push(key);
    writeHidden(data);
  }
}

export function unhideItem(kind: HiddenKind, id: string): void {
  const data = readHidden();
  const key = kind === "repo" ? id.trim().toLowerCase() : id.trim();
  if (kind === "repo") {
    data.repos = data.repos.filter((r) => r !== key);
  } else {
    data.digest = data.digest.filter((d) => d !== key);
  }
  writeHidden(data);
}
