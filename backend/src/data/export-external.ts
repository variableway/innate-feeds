/**
 * Static export of the external feed sources (GH #31) for Pages mode:
 * writes frontend/public/data/external/{source}.json (latest snapshot per
 * source) + index.json. No backend needed on the Pages side.
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getProjectRoot } from "./app-config.js";
import { listExternalSources, readExternalSource } from "./external-store.js";

export function exportExternalStatic(parentOutDir?: string): {
  dest: string;
  exported: number;
} {
  const outDir = join(
    parentOutDir ?? join(getProjectRoot(), "frontend/public/data"),
    "external",
  );
  mkdirSync(outDir, { recursive: true });

  const entries = listExternalSources();
  let exported = 0;
  for (const entry of entries) {
    const payload = readExternalSource(entry.source);
    if (!payload || !payload.items.length) continue;
    writeFileSync(
      join(outDir, `${entry.source}.json`),
      JSON.stringify(payload, null, 2),
    );
    exported++;
  }

  writeFileSync(
    join(outDir, "index.json"),
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        sources: entries.map(({ snapshots, ...rest }) => ({
          ...rest,
          synced: snapshots > 0,
        })),
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
  /export-external\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const result = exportExternalStatic();
  console.log(
    `Exported external sources → ${result.dest} (${result.exported} sources)`,
  );
}
