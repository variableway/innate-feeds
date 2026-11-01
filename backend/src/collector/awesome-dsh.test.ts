import { describe, expect, test } from "bun:test";
import {
  normalizeMarketIndex,
  resolveDisplayName,
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

  test("uses the upstream title as display name so bundle repos stay distinct", () => {
    const plugins = normalizeMarketIndex(
      indexWith([
        {
          name: "dsh-file-activity",
          title: "baosfeng/my-dsh-plugins#dsh-file-activity",
          homepage:
            "https://awesome-dsh-plugin.com/p/baosfeng/my-dsh-plugins--dsh-file-activity/",
          description: { en: "Sidebar file activity" },
          repository: { url: "https://github.com/baosfeng/my-dsh-plugins" },
          metadata: { category: "dev" },
        },
        {
          name: "dsh-my-memory",
          title: "baosfeng/my-dsh-plugins#dsh-my-memory",
          homepage:
            "https://awesome-dsh-plugin.com/p/baosfeng/my-dsh-plugins--dsh-my-memory/",
          description: { en: "Memory scopes" },
          repository: { url: "https://github.com/baosfeng/my-dsh-plugins" },
          metadata: { category: "memory" },
        },
      ]),
      fetchedAt,
    );

    expect(plugins.map((plugin) => plugin.name)).toEqual([
      "baosfeng/my-dsh-plugins#dsh-file-activity",
      "baosfeng/my-dsh-plugins#dsh-my-memory",
    ]);
    // Display names no longer collide even though both live in one repository.
    expect(new Set(plugins.map((plugin) => plugin.name)).size).toBe(2);
    expect(plugins[0]!.upstreamUrl).toBe(
      "https://awesome-dsh-plugin.com/p/baosfeng/my-dsh-plugins--dsh-file-activity/",
    );
  });

  test("falls back to the repository path when the title carries no identity", () => {
    const plugins = normalizeMarketIndex(
      indexWith([
        {
          name: "dsh-undo-plugin",
          title: "dsh-undo-plugin",
          description: { en: "Undo support" },
          repository: { url: "https://github.com/23swccp/dsh-undo" },
          metadata: { category: "dev" },
        },
      ]),
      fetchedAt,
    );

    expect(plugins[0]!.name).toBe("23swccp/dsh-undo");
    expect(plugins[0]!.upstreamUrl).toBeNull();
  });

  test("resolveDisplayName keeps the repository prefix", () => {
    expect(resolveDisplayName("owner/repo#sub", "owner/repo")).toBe(
      "owner/repo#sub",
    );
    expect(resolveDisplayName("owner/repo", "owner/repo")).toBe("owner/repo");
    expect(resolveDisplayName("bare-plugin", "owner/repo")).toBe("owner/repo");
    expect(resolveDisplayName("", "owner/repo")).toBe("owner/repo");
    expect(resolveDisplayName("other/repo#sub", "owner/repo")).toBe(
      "owner/repo",
    );
  });

  test("disambiguates display names that still collide after the fallback", () => {
    const plugins = normalizeMarketIndex(
      indexWith([
        {
          name: "dsh-extension-hub",
          title: "Relistencode/dsh-extension-hub",
          description: { en: "Extension center" },
          repository: {
            url: "https://github.com/Relistencode/dsh-extension-hub",
          },
          metadata: { category: "market" },
        },
        {
          name: "dsh-myrules",
          // A bare plugin name: falls back to owner/repo and collides.
          title: "dsh-extension-hub",
          description: { en: "Global rules editor" },
          repository: {
            url: "https://github.com/Relistencode/dsh-extension-hub",
          },
          metadata: { category: "dev" },
        },
      ]),
      fetchedAt,
    );

    expect(plugins).toHaveLength(2);
    expect(plugins.map((plugin) => plugin.name)).toEqual([
      "Relistencode/dsh-extension-hub#dsh-extension-hub",
      "Relistencode/dsh-extension-hub#dsh-myrules",
    ]);
    expect(new Set(plugins.map((plugin) => plugin.name)).size).toBe(2);
  });
});
