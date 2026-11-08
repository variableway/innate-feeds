/**
 * Static export of GitHub Hot snapshots (GH #63, M1 heat engine) for Pages
 * mode: writes frontend/public/data/hot/{manifest.json, hot-{date}.json}.
 * No backend needed on the Pages side. Source of truth is the SQLite
 * hot_snapshots table (kept ≤30 days by saveHotSnapshot).
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getDb, getHotSnapshot, getHotSnapshotDates } from "../db/index.js";
import { getProjectRoot } from "./app-config.js";

export function exportHotStatic(parentOutDir?: string): {
  dest: string;
  exported: number;
} {
  const outDir = join(
    parentOutDir ?? join(getProjectRoot(), "frontend/public/data"),
    "hot",
  );
  mkdirSync(outDir, { recursive: true });

  const db = getDb();
  const dates = getHotSnapshotDates(db);
  let exported = 0;
  const entries: { date: string; count: number }[] = [];
  for (const date of dates) {
    const snapshot = getHotSnapshot(db, date);
    if (!snapshot || !snapshot.items.length) continue;
    writeFileSync(
      join(outDir, `hot-${date}.json`),
      JSON.stringify(snapshot, null, 2),
    );
    entries.push({ date, count: snapshot.items.length });
    exported++;
  }

  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(
      {
        ruleVersion: entries.length
          ? getHotSnapshot(db, entries[0].date)?.ruleVersion ?? null
          : null,
        updatedAt: new Date().toISOString(),
        snapshots: entries,
      },
      null,
      2,
    ),
  );

  return { dest: outDir, exported };
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /export-hot\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const result = exportHotStatic();
  console.log(`Exported hot snapshots → ${result.dest} (${result.exported} dates)`);
}
