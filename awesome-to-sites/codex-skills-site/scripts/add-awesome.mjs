#!/usr/bin/env node

/**
 * add-awesome.mjs
 *
 * Register a new awesome list repository: clone it, convert to JSON, merge categories.
 *
 * Usage:
 *   node scripts/add-awesome.mjs <github-url> [--output-dir <dir>]
 *
 * Example:
 *   node scripts/add-awesome.mjs https://github.com/user/awesome-list
 *   node scripts/add-awesome.mjs https://github.com/user/awesome-list --output-dir ../my-repos
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, basename, join } from "node:path";

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: "utf-8", stdio: "inherit" });
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Usage: node scripts/add-awesome.mjs <github-url> [options]

Arguments:
  <github-url>          GitHub repository URL to clone and convert

Options:
  --output-dir <dir>    Directory to clone into (default: parent of this project)
  --name <name>         Display name for the source
  -h, --help            Show this help

Examples:
  node scripts/add-awesome.mjs https://github.com/user/awesome-list
  node scripts/add-awesome.mjs https://github.com/user/awesome-list --output-dir ~/repos
`);
    process.exit(0);
  }

  const url = args[0].replace(/\.git$/, "");
  const opts = {};
  for (let i = 1; i < args.length; i += 2) {
    opts[args[i].replace(/^--/, "")] = args[i + 1];
  }

  // Derive repo name from URL
  const repoName = url.split("/").pop();
  const outputDir = resolve(opts["output-dir"] || resolve(".."));
  const repoPath = join(outputDir, repoName);

  // 1. Clone if not already present
  if (existsSync(repoPath)) {
    console.log(`Repository already exists at ${repoPath}`);
    console.log("Pulling latest...");
    try {
      run("git pull --ff-only", repoPath);
    } catch (e) {
      console.warn(`Warning: git pull failed: ${e.message}`);
    }
  } else {
    console.log(`Cloning ${url} into ${repoPath}...`);
    run(`git clone --depth 1 ${url} "${repoPath}"`, outputDir);
  }

  // 2. Run converter
  console.log("\nConverting to JSON...");
  const convertArgs = [
    "node", "scripts/convert-awesome.mjs", `"${repoPath}"`,
    "--repo-url", url,
    "--merge-categories",
  ];
  if (opts.name) convertArgs.push("--name", `"${opts.name}"`);
  run(convertArgs.join(" "), resolve("."));

  console.log(`\nDone! Source "${repoName}" registered.`);
  console.log(`\nTo sync later: npm run awesome:sync -- "${repoPath}"`);
}

main();
