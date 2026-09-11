import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ExternalFeedItem, FeedSource, SaveResult } from "./types.js";

export interface ManifestEntry {
  filename: string;
  count: number;
  fetchedAt: string;
  label: string;
}

export interface Manifest {
  source: FeedSource;
  updatedAt: string;
  entries: ManifestEntry[];
}

export function getSourceDir(source: FeedSource): string {
  const home = process.env.INNATE_HOME || join(homedir(), ".innate");
  return join(home, source);
}

export function readManifest(source: FeedSource): Manifest | null {
  const dir = getSourceDir(source);
  const path = join(dir, "manifest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeManifest(source: FeedSource, manifest: Manifest): void {
  const dir = getSourceDir(source);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

export function saveItems(
  source: FeedSource,
  items: ExternalFeedItem[],
  label: string,
  filename?: string,
): SaveResult {
  const dir = getSourceDir(source);
  mkdirSync(dir, { recursive: true });

  const fname = filename || `${label}.json`;
  const payload = {
    source,
    label,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
  const json = JSON.stringify(payload, null, 2);
  const filePath = join(dir, fname);
  writeFileSync(filePath, json, "utf-8");

  const manifest = readManifest(source) || {
    source,
    updatedAt: new Date().toISOString(),
    entries: [],
  };

  const existingIdx = manifest.entries.findIndex((e) => e.filename === fname);
  const entry: ManifestEntry = {
    filename: fname,
    count: items.length,
    fetchedAt: payload.fetchedAt,
    label,
  };
  if (existingIdx >= 0) {
    manifest.entries[existingIdx] = entry;
  } else {
    manifest.entries.push(entry);
  }
  manifest.updatedAt = payload.fetchedAt;
  writeManifest(source, manifest);

  return {
    source,
    outDir: dir,
    files: [filePath, join(dir, "manifest.json")],
    count: items.length,
    bytes: Buffer.byteLength(json, "utf-8"),
  };
}
