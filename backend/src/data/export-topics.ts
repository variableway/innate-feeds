/**
 * Static export for the GitHub Topics datasource (GH #24).
 *
 * Copies the topic store (~/.innate/github-topics/topics) into the static
 * data dir so GitHub Pages / static mode can serve the topic feeds without a
 * backend. The "existing" flag (repo already in the trending/starred feeds) is
 * resolved at export time from SQLite.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import type { Database } from "bun:sqlite";
import { listKnownRepoFullNames } from "../db/index.js";
import {
  getTopicsDir,
  readTopicIndex,
  readTopicSnapshot,
  topicFileName,
  toTopicRepo,
  type TopicResponse,
} from "./topics-store.js";

export interface TopicsExportResult {
  exported: number;
  dest: string | null;
}

/**
 * Write `{outDir}/topics/index.json` + `{outDir}/topics/{topic}.json`.
 * No-op when no topic has been synced yet.
 */
export function exportTopicsStatic(
  outDir: string,
  db: Database,
): TopicsExportResult {
  const srcDir = getTopicsDir();
  if (!existsSync(srcDir)) {
    return { exported: 0, dest: null };
  }

  const index = readTopicIndex();
  if (!index) {
    return { exported: 0, dest: null };
  }

  const destDir = join(outDir, "topics");
  mkdirSync(destDir, { recursive: true });

  const existing = listKnownRepoFullNames(db);
  const topics: {
    topic: string;
    count: number;
    newCount: number;
    existingCount: number;
    fetchedAt: string;
  }[] = [];

  for (const entry of index.topics) {
    const snapshot = readTopicSnapshot(entry.topic);
    if (!snapshot) continue;
    const items = snapshot.items.map((item) =>
      toTopicRepo(item, snapshot.fetchedAt, existing),
    );
    const payload: TopicResponse = {
      topic: snapshot.topic,
      fetchedAt: snapshot.fetchedAt,
      count: items.length,
      newCount: items.filter((i) => i.isNew && !i.existing).length,
      existingCount: items.filter((i) => i.existing).length,
      items,
    };
    writeFileSync(
      join(destDir, topicFileName(snapshot.topic)),
      JSON.stringify(payload, null, 2),
      "utf-8",
    );
    topics.push({
      topic: snapshot.topic,
      count: payload.count,
      newCount: payload.newCount,
      existingCount: payload.existingCount,
      fetchedAt: payload.fetchedAt,
    });
  }

  topics.sort(
    (a, b) => b.newCount - a.newCount || a.topic.localeCompare(b.topic),
  );
  writeFileSync(
    join(destDir, "index.json"),
    JSON.stringify(
      { source: "github-topics", updatedAt: index.updatedAt, topics },
      null,
      2,
    ),
    "utf-8",
  );

  // Defensive: copy topic files that are not listed in the index.
  for (const name of readdirSync(srcDir)) {
    if (!name.endsWith(".json") || name === "index.json") continue;
    const dest = join(destDir, name);
    if (existsSync(dest)) continue;
    writeFileSync(dest, readFileSync(join(srcDir, name), "utf-8"), "utf-8");
  }

  return { exported: topics.length, dest: destDir };
}
