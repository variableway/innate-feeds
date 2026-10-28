/**
 * Static export for Trendshift slices (GH #23).
 * Copies the local store (~/.innate/trendshift) into the static data dir so
 * GitHub Pages / static mode can serve ranking archives without a backend.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import {
  getTrendshiftDir,
  readTrendshiftManifest,
  sliceFileName,
  TRENDSHIFT_LANGUAGES,
  TRENDSHIFT_TIMEFRAMES,
  type TrendshiftTimeframe,
  type TrendshiftLanguageFilter,
} from "../collector/trendshift.js";

export interface TrendshiftExportResult {
  copied: number;
  files: string[];
  dest: string | null;
}

/**
 * Copy every local slice file into `{outDir}/trendshift/{timeframe}/…` and
 * write a small `index.json`. No-op when nothing has been synced yet.
 */
export function exportTrendshiftStatic(outDir: string): TrendshiftExportResult {
  const srcDir = getTrendshiftDir();
  if (!existsSync(srcDir)) {
    return { copied: 0, files: [], dest: null };
  }

  const destDir = join(outDir, "trendshift");
  mkdirSync(destDir, { recursive: true });

  const manifest = readTrendshiftManifest();
  const files: string[] = [];
  const indexFiles: {
    path: string;
    timeframe: TrendshiftTimeframe;
    language: TrendshiftLanguageFilter;
    count: number;
    fetchedAt: string;
  }[] = [];

  for (const timeframe of TRENDSHIFT_TIMEFRAMES) {
    const srcTfDir = join(srcDir, timeframe);
    if (!existsSync(srcTfDir) || !statSync(srcTfDir).isDirectory()) continue;
    mkdirSync(join(destDir, timeframe), { recursive: true });

    for (const language of TRENDSHIFT_LANGUAGES) {
      const name = sliceFileName(timeframe, language);
      const src = join(srcTfDir, name);
      if (!existsSync(src)) continue;
      const relPath = `${timeframe}/${name}`;
      copyFileSync(src, join(destDir, relPath));
      files.push(relPath);

      const entry = manifest?.files.find((f) => f.path === relPath);
      indexFiles.push({
        path: relPath,
        timeframe,
        language,
        count: entry?.count ?? 0,
        fetchedAt: entry?.fetchedAt ?? "",
      });
    }
  }

  // Also copy any slice files not covered by the known matrix (defensive).
  for (const timeframe of readdirSync(srcDir)) {
    const srcTfDir = join(srcDir, timeframe);
    if (!statSync(srcTfDir).isDirectory()) continue;
    for (const name of readdirSync(srcTfDir)) {
      const relPath = `${timeframe}/${name}`;
      if (files.includes(relPath)) continue;
      const src = join(srcTfDir, name);
      mkdirSync(join(destDir, timeframe), { recursive: true });
      copyFileSync(src, join(destDir, relPath));
      files.push(relPath);
    }
  }

  writeIndex(destDir, indexFiles, manifest?.updatedAt ?? null);
  return { copied: files.length, files, dest: destDir };
}

function writeIndex(
  destDir: string,
  files: {
    path: string;
    timeframe: string;
    language: string;
    count: number;
    fetchedAt: string;
  }[],
  updatedAt: string | null,
): void {
  const index = {
    schemaVersion: 1,
    updatedAt,
    files,
  };
  writeFileSync(
    join(destDir, "index.json"),
    JSON.stringify(index, null, 2),
    "utf-8",
  );
}
