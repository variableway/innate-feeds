import { describe, expect, it } from "vitest";
import { dateDaysAgo, isoDaysAgo } from "./date-window.js";

describe("dateDaysAgo", () => {
  it("returns UTC YYYY-MM-DD 90 days before a fixed instant", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    expect(dateDaysAgo(90, now)).toBe("2026-05-15");
  });

  it("falls back to 90 days for invalid input", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    expect(dateDaysAgo(0, now)).toBe("2026-05-15");
    expect(dateDaysAgo(-3, now)).toBe("2026-05-15");
  });
});

describe("isoDaysAgo", () => {
  it("returns a full ISO timestamp", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    expect(isoDaysAgo(1, now)).toBe("2026-08-12T12:00:00.000Z");
  });
});
