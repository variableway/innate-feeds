#!/usr/bin/env node

/**
 * sync-awesome.mjs
 *
 * Pulls latest changes from an awesome repo and re-generates the JSON data.
 * Reports added, removed, and changed items.
 *
 * Usage:
 *   node scripts/sync-awesome.mjs <repo-path> [--source <json-path>]
 *
 * Example:
 *   node scripts/sync-awesome.mjs ../awesome-codex-skills
 *   node scripts/sync-awesome.mjs ../awesome-codex-skills --source content/sources/awesome-codex-skills.json
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Usage: node scripts/sync-awesome.mjs <repo-path> [options]

Arguments:
  <repo-path>           Path to the cloned awesome list repository

Options:
  --source <path>       Path to existing source JSON (default: content/sources/<repo-name>.json)
  --no-pull             Skip git pull (just re-convert)
  -h, --help            Show this help

Examples:
  node scripts/sync-awesome.mjs ../awesome-codex-skills
`);
    process.exit(0);
  }

  const repoPath = resolve(args[0]);
  const repoName = basename(repoPath);
  const opts = {};
  for (let i = 1; i < args.length; i += 2) {
    opts[args[i].replace(/^--/, "")] = args[i + 1];
  }
  const sourcePath = opts.source || `content/sources/${repoName}.json`;
  const noPull = args.includes("--no-pull");

  // 1. Load existing data for diffing
  let oldItems = [];
  let oldSource = null;
  if (existsSync(sourcePath)) {
    const old = JSON.parse(readFileSync(sourcePath, "utf-8"));
    oldItems = old.items || [];
    oldSource = old.source || null;
    console.log(`Loaded ${oldItems.length} existing items from ${sourcePath}`);
  } else {
    console.log(`No existing ${sourcePath} — will create fresh`);
  }

  // 2. Pull latest
  if (!noPull) {
    console.log(`Pulling latest from ${repoPath}...`);
    try {
      const result = run("git pull --ff-only", repoPath);
      console.log(result);
    } catch (e) {
      console.warn(`Warning: git pull failed: ${e.message}`);
      console.warn("Continuing with current state...");
    }
  }

  // 3. Re-run converter
  console.log("\nRunning converter...");
  const convertArgs = [
    "node", "scripts/convert-awesome.mjs", repoPath,
    "--output", sourcePath,
  ];
  if (oldSource?.repo) convertArgs.push("--repo-url", oldSource.repo);
  execSync(convertArgs.join(" "), { cwd: resolve("."), stdio: "inherit" });

  // 4. Diff
  const newData = JSON.parse(readFileSync(sourcePath, "utf-8"));
  const newItems = newData.items;

  const oldSlugs = new Set(oldItems.map((i) => i.slug));
  const newSlugs = new Set(newItems.map((i) => i.slug));

  const added = newItems.filter((i) => !oldSlugs.has(i.slug));
  const removed = oldItems.filter((i) => !newSlugs.has(i.slug));
  const unchanged = newItems.filter((i) => oldSlugs.has(i.slug));

  // Check for description changes
  const changed = [];
  for (const newItem of unchanged) {
    const oldItem = oldItems.find((i) => i.slug === newItem.slug);
    if (oldItem && oldItem.description !== newItem.description) {
      changed.push({ slug: newItem.slug, oldDesc: oldItem.description, newDesc: newItem.description });
    }
  }

  // 5. Report
  console.log("\n=== Sync Report ===");
  console.log(`Total items: ${newItems.length} (was ${oldItems.length})`);

  if (added.length > 0) {
    console.log(`\n+ Added (${added.length}):`);
    for (const item of added) {
      console.log(`  + ${item.slug} [${item.category}] — ${item.description.slice(0, 80)}...`);
    }
  }

  if (removed.length > 0) {
    console.log(`\n- Removed (${removed.length}):`);
    for (const item of removed) {
      console.log(`  - ${item.slug}`);
    }
  }

  if (changed.length > 0) {
    console.log(`\n~ Changed (${changed.length}):`);
    for (const item of changed) {
      console.log(`  ~ ${item.slug}`);
    }
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    console.log("\nNo changes detected.");
  }

  // 6. Update lastSynced timestamp
  newData.source.lastSynced = new Date().toISOString();
  writeFileSync(sourcePath, JSON.stringify(newData, null, 2) + "\n");

  console.log("\nSync complete.");
}

main();
