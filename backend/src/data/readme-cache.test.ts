import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  listCachedReadmes,
  shouldSkipReadmeRefresh,
  writeCachedReadme,
} from "./readme-cache.js";

describe("listCachedReadmes", () => {
  const dirs: string[] = [];
  const prev = process.env.READMES_DIR;

  afterEach(() => {
    if (prev === undefined) delete process.env.READMES_DIR;
    else process.env.READMES_DIR = prev;
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists ./readmes-style {owner}/{repo}.md entries", () => {
    const root = mkdtempSync(join(tmpdir(), "innate-readmes-"));
    dirs.push(root);
    process.env.READMES_DIR = root;

    writeCachedReadme("acme", "widgets", {
      fullName: "acme/widgets",
      name: "README.md",
      markdown: "# Widgets\n",
      htmlUrl: "https://github.com/acme/widgets",
      encoding: "utf-8",
    });

    const items = listCachedReadmes();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      owner: "acme",
      repo: "widgets",
      fullName: "acme/widgets",
      relativePath: "acme/widgets.md",
    });
    expect(items[0].size).toBeGreaterThan(0);
  });
});

describe("shouldSkipReadmeRefresh", () => {
  it("refreshes when there is no fetchedAt or maxAge is 0", () => {
    expect(shouldSkipReadmeRefresh(null, 1000, 10_000)).toBe(false);
    expect(shouldSkipReadmeRefresh("2026-08-13T00:00:00.000Z", 0, 10_000)).toBe(
      false,
    );
  });

  it("skips when the cache is newer than maxAge", () => {
    const fetchedAt = "2026-08-13T12:00:00.000Z";
    const now = Date.parse(fetchedAt) + 60_000;
    expect(shouldSkipReadmeRefresh(fetchedAt, 5 * 60_000, now)).toBe(true);
    expect(shouldSkipReadmeRefresh(fetchedAt, 30_000, now)).toBe(false);
  });
});
