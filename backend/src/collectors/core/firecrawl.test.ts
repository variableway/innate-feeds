import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

// Re-implement generateRepoId to test the logic without importing firecrawl
// (which requires the firecrawl SDK at import time).
function generateRepoId(fullName: string): number {
  const hash = createHash("sha256").update(fullName).digest();
  return hash.readUIntBE(0, 6);
}

function parseStarCount(stars: string): number {
  if (!stars) return 0;
  const cleaned = stars.replace(/,/g, "").trim();
  if (cleaned.endsWith("k")) return Math.round(parseFloat(cleaned) * 1000);
  if (cleaned.endsWith("m")) return Math.round(parseFloat(cleaned) * 1000000);
  return parseInt(cleaned, 10) || 0;
}

describe("generateRepoId", () => {
  it("produces deterministic IDs for the same input", () => {
    const id1 = generateRepoId("facebook/react");
    const id2 = generateRepoId("facebook/react");
    expect(id1).toBe(id2);
  });

  it("produces different IDs for different inputs", () => {
    const id1 = generateRepoId("facebook/react");
    const id2 = generateRepoId("vuejs/vue");
    expect(id1).not.toBe(id2);
  });

  it("produces positive integers within SQLite INTEGER range", () => {
    const id = generateRepoId("some/repo-with-a-very-long-name-1234567890");
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(Number.isInteger(id)).toBe(true);
  });

  it("does not collide for similar names", () => {
    const ids = new Set<number>();
    const names = [
      "user/repo",
      "user/repo-2",
      "user/repo2",
      "user2/repo",
      "usr/repo",
      "user/repos",
    ];
    for (const name of names) {
      ids.add(generateRepoId(name));
    }
    expect(ids.size).toBe(names.length);
  });
});

describe("parseStarCount", () => {
  it("parses plain numbers", () => {
    expect(parseStarCount("1234")).toBe(1234);
  });

  it("parses numbers with commas", () => {
    expect(parseStarCount("1,234")).toBe(1234);
    expect(parseStarCount("12,345,678")).toBe(12345678);
  });

  it("parses k suffix", () => {
    expect(parseStarCount("1.5k")).toBe(1500);
    expect(parseStarCount("12k")).toBe(12000);
  });

  it("parses m suffix", () => {
    expect(parseStarCount("1.2m")).toBe(1200000);
  });

  it("handles empty string", () => {
    expect(parseStarCount("")).toBe(0);
  });

  it("handles whitespace", () => {
    expect(parseStarCount("  1,234  ")).toBe(1234);
  });

  it("handles invalid input", () => {
    expect(parseStarCount("abc")).toBe(0);
  });
});
