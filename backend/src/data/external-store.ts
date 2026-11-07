/**
 * External feed sources store (GH #31).
 *
 * Serves the JSON-store collectors (Product Hunt / YC / a16z / Hacker News /
 * Hugging Face / GitHub-new / Dev.to / lobste.rs) to the API and static
 * export. Each source dir under INNATE_HOME has a manifest.json listing
 * saved snapshots; the API serves the latest by default.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  getSourceDir,
  readManifest,
  type ManifestEntry,
} from "../collectors/shared/storage.js";
import type {
  ExternalFeedItem,
  FeedSource,
} from "../collectors/shared/types.js";

/** Sources served by /api/external* (trendshift/topics/awesome-dsh have their own APIs). */
import { EXTERNAL_SOURCES } from "../../../shared/sources/external.js";

/** S0：External wire 契约收敛至 shared/types/external，此处 re-export。 */
import type {
  ExternalSourceEntry,
  ExternalSourcePayload,
} from "../../../shared/types/external.js";

export { EXTERNAL_SOURCES };
export type { ExternalSourceEntry, ExternalSourcePayload };

function readLatestEntry(source: FeedSource): ManifestEntry | null {
  const manifest = readManifest(source);
  if (!manifest?.entries.length) return null;
  // entries are appended chronologically; last written wins
  return manifest.entries[manifest.entries.length - 1];
}

function readSnapshotFile(
  source: FeedSource,
  filename: string,
): ExternalSourcePayload | null {
  const dir = getSourceDir(source);
  const path = join(dir, filename);
  if (!existsSync(path)) return null;
  try {
    const payload = JSON.parse(readFileSync(path, "utf-8")) as {
      label?: string;
      fetchedAt?: string;
      count?: number;
      items?: ExternalFeedItem[];
    };
    const meta = EXTERNAL_SOURCES.find((s) => s.source === source);
    return {
      source,
      title: meta?.title ?? source,
      description: meta?.description ?? "",
      label: payload.label ?? "",
      fetchedAt: payload.fetchedAt ?? "",
      count: payload.items?.length ?? 0,
      items: payload.items ?? [],
    };
  } catch (err) {
    console.error(`[external-store] Failed to read ${path}:`, err);
    return null;
  }
}

/** Index of all external sources (with their latest snapshot meta). */
export function listExternalSources(): ExternalSourceEntry[] {
  return EXTERNAL_SOURCES.map((meta) => {
    const latest = readLatestEntry(meta.source);
    const manifest = readManifest(meta.source);
    return {
      source: meta.source,
      title: meta.title,
      description: meta.description,
      homepage: meta.homepage,
      count: latest?.count ?? 0,
      label: latest?.label ?? null,
      fetchedAt: latest?.fetchedAt ?? null,
      snapshots: manifest?.entries.length ?? 0,
    };
  });
}

/** One source's latest snapshot (or a specific label). */
export function readExternalSource(
  source: string,
  label?: string,
): ExternalSourcePayload | null {
  const meta = EXTERNAL_SOURCES.find((s) => s.source === source);
  if (!meta) return null;
  if (label) return readSnapshotFile(meta.source, `${label}.json`);
  const latest = readLatestEntry(meta.source);
  if (!latest) return null;
  return readSnapshotFile(meta.source, latest.filename);
}
