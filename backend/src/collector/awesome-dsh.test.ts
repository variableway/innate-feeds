import { describe, expect, test } from "bun:test";
import {
  normalizeMarketIndex,
  slugFromRepoPath,
  type AwesomeMarketIndex,
} from "./awesome-dsh.js";

const fetchedAt = "2026-10-31T00:00:00.000Z";

function indexWith(
  plugins: AwesomeMarketIndex["plugins"] = [],
): AwesomeMarketIndex {
  return { format: 1, plugins };
}

describe("awesome DSH market catalog", () => {
  test("normalizes market index entries and prefers npm install", () => {
    const plugins = normalizeMarketIndex(
      indexWith([
        {
          name: "dsh-example",
          description: { en: "Example plugin", zh: "示例插件" },
          repository: { url: "https://github.com/example-org/dsh-example" },
          metadata: { category: "ui" },
          versions: [
            { version: "0.1.0", publishTimestamp: 1_700_000_000 },
            { version: "0.2.0", publishTimestamp: 1_800_000_000 },
          ],
        },
      ]),
      fetchedAt,
      { "https://github.com/example-org/dsh-example": 42 },
      {
        "https://github.com/example-org/dsh-example": ["one.png", "two.png"],
      },
    );

    expect(plugins).toHaveLength(1);
    const plugin = plugins[0]!;
    expect(plugin.slug).toBe("example-org-dsh-example");
    expect(plugin.name).toBe("example-org/dsh-example");
    expect(plugin.stars).toBe(42);
    expect(plugin.installCommand).toBe(
      "dsh plugin --profile web add dsh-example",
    );
    expect(plugin.npmPackage).toBe("dsh-example");
    expect(plugin.publishedAt).toBe(
      new Date(1_800_000_000 * 1000).toISOString(),
    );
    expect(plugin.screenshotUrl).toBe("one.png");
    expect(plugin.screenshots).toEqual(["two.png"]);
    expect(plugin.content).toContain(
      "dsh plugin --profile web add dsh-example",
    );
  });

  test("drops invalid categories and repositories, but keeps npm variants per repo", () => {
    const plugins = normalizeMarketIndex(
      indexWith([
        {
          name: "missing-category",
          description: { en: "Invalid category" },
          repository: { url: "https://github.com/example-org/one" },
          metadata: { category: "not-real" },
        },
        {
          name: "missing-repo",
          description: { en: "Invalid repository" },
          metadata: { category: "ui" },
        },
        {
          name: "first",
          description: { en: "First duplicate" },
          repository: { url: "https://github.com/example-org/two" },
          metadata: { category: "ui" },
        },
        {
          name: "second",
          description: { en: "Second duplicate" },
          repository: { url: "https://github.com/example-org/two" },
          metadata: { category: "ui" },
        },
      ]),
      fetchedAt,
    );

    expect(plugins).toHaveLength(2);
    expect(plugins.map((plugin) => plugin.npmPackage)).toEqual([
      "first",
      "second",
    ]);
    expect(plugins.map((plugin) => plugin.slug)).toEqual([
      "example-org-two",
      "example-org-two-second",
    ]);
  });

  test("makes filesystem-safe slugs from repository paths", () => {
    expect(slugFromRepoPath("Example Org/dsh--example_v2")).toBe(
      "example-org-dsh-example-v2",
    );
  });
});
