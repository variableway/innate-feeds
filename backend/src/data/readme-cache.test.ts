import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { listCachedReadmes, writeCachedReadme } from "./readme-cache.js";

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
