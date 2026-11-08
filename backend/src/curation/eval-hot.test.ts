import { describe, test, expect } from "bun:test";
import { computeEval } from "./eval-hot.js";

const mk = (fullName: string, sources: string[]) => ({
  fullName,
  heat: 1,
  signals: sources.map((source) => ({ source })),
});

describe("eval-hot metrics", () => {
  const items = [
    mk("a/two", ["digest", "trending"]),
    mk("b/one", ["digest"]),
    mk("c/trend", ["trending"]),
    mk("d/one", ["digest"]),
  ];

  test("baseline overlap ratio", () => {
    const r = computeEval({
      date: "2026-11-08",
      items,
      prevItems: null,
      trendingFullNames: ["a/two", "c/trend", "x/only"],
      trendingDate: "2026-11-08",
    });
    // hot top10 = all 4 items; trending ∩ hot = a/two + c/trend = 2 of 3
    expect(r.baselineOverlap10?.overlap).toBe(2);
    expect(r.baselineOverlap10?.ratio).toBe(67);
    // false-negative: x/only missing from hot top50
    expect(r.falseNegative.missing).toEqual(["x/only"]);
    expect(r.falseNegative.trendingInHot).toBe(2);
  });

  test("multi-signal ratio top10", () => {
    const r = computeEval({
      date: "2026-11-08",
      items,
      prevItems: null,
      trendingFullNames: [],
      trendingDate: null,
    });
    // 1 of 4 items has ≥2 sources
    expect(r.multiSignalRatio.top10).toBe(25);
    expect(r.verdicts.find((v) => v.check === "multiSignal")?.status).toBe(
      "ok",
    );
    expect(r.verdicts.find((v) => v.check === "baselineOverlap")?.status).toBe(
      "warn",
    );
  });

  test("decay survivors from previous top10", () => {
    const prev = [mk("a/two", []), mk("gone/away", []), mk("b/one", [])];
    const r = computeEval({
      date: "2026-11-08",
      items,
      prevItems: prev,
      trendingFullNames: [],
      trendingDate: null,
    });
    // a/two + b/one still in today's list → 2/3 survived
    expect(r.decayCheck.survived).toBe(2);
    expect(r.decayCheck.ofPrevTop).toBe(3);
  });

  test("source health counts distinct sources per item", () => {
    const r = computeEval({
      date: "2026-11-08",
      items,
      prevItems: null,
      trendingFullNames: [],
      trendingDate: null,
    });
    expect(r.sourceHealth["digest"]).toBe(3);
    expect(r.sourceHealth["trending"]).toBe(2);
  });
});
