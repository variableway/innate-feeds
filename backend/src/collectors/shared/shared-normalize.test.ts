import { describe, test, expect } from "bun:test";
import {
  normalizeExternalItem,
  normalizeFeedSource,
} from "../../../../shared/normalize/external.js";

describe("shared/normalize/external (S1)", () => {
  test("coerces strings, nullables, metrics, categories", () => {
    const out = normalizeExternalItem({
      id: "yc-123",
      source: "yc",
      title: "Acme",
      tagline: "  ",
      description: null,
      url: "https://yc.com/acme",
      externalUrl: "",
      categories: ["ai", 42],
      metrics: { score: "17", stars: 1200, batch: "P26", status: null },
      metadata: { launch: "yes" },
      publishedAt: "2026-11-01",
    });
    // 契约保持：str() 只做 String() 转换，不 trim（与原前端实现一致）
    expect(out.tagline).toBe("  ");
    expect(out.description).toBe("");
    expect(out.externalUrl).toBeNull();
    expect(out.categories).toEqual(["ai", "42"]);
    expect(out.metrics.score).toBe(17);
    expect(out.metrics.stars).toBe(1200);
    expect(out.metrics.batch).toBe("P26");
    expect(out.metrics.status).toBeUndefined();
    expect(out.metadata).toEqual({ launch: "yes" });
    expect(out.publishedAt).toBe("2026-11-01");
  });

  test("unknown source falls back to producthunt; nulls → null", () => {
    const out = normalizeExternalItem({
      source: "not-a-source",
      externalUrl: null,
      imageUrl: undefined,
      publishedAt: null,
    });
    expect(out.source).toBe("producthunt");
    expect(out.externalUrl).toBeNull();
    expect(out.imageUrl).toBeNull();
    expect(out.publishedAt).toBeNull();
  });

  test("normalizeFeedSource passes through valid members", () => {
    expect(normalizeFeedSource("edu-videos-bilibili")).toBe(
      "edu-videos-bilibili",
    );
    expect(normalizeFeedSource(undefined)).toBe("producthunt");
  });

  test("normalization is idempotent (re-run on output is a no-op)", () => {
    const once = normalizeExternalItem({
      id: "hn-9",
      source: "hackernews",
      title: "T",
    });
    const twice = normalizeExternalItem(once);
    expect(twice).toEqual(once);
  });
});
