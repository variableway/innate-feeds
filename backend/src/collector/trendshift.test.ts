import { describe, expect, test } from "bun:test";
import {
  derivePeriodKey,
  mergeSliceRows,
  normalizeCdnRecord,
  normalizeScrapedRecord,
  parseInitialData,
  type TrendshiftRepo,
} from "./trendshift.js";

describe("derivePeriodKey", () => {
  test("daily uses the date field", () => {
    expect(derivePeriodKey("daily", { date: "2026-10-28T00:00:00Z" })).toBe(
      "2026-10-28",
    );
  });

  test("weekly pads the ISO week number", () => {
    expect(derivePeriodKey("weekly", { year: 2026, week: 4 })).toBe("2026-W04");
    expect(derivePeriodKey("weekly", { year: 2026, week: 44 })).toBe(
      "2026-W44",
    );
  });

  test("monthly pads the month number", () => {
    expect(derivePeriodKey("monthly", { year: 2026, month: 1 })).toBe(
      "2026-M01",
    );
    expect(derivePeriodKey("monthly", { year: 2024, month: 12 })).toBe(
      "2024-M12",
    );
  });

  test("yearly is the bare year", () => {
    expect(derivePeriodKey("yearly", { year: 2025 })).toBe("2025");
  });

  test("prefers an explicit period_key when present", () => {
    expect(
      derivePeriodKey("daily", {
        period_key: "2025-01-01",
        date: "2026-10-28T00:00:00Z",
      }),
    ).toBe("2025-01-01");
  });

  test("weekly falls back to ISO week of the date", () => {
    // 2026-10-28 is a Wednesday in ISO week 44.
    expect(derivePeriodKey("weekly", { date: "2026-10-28T00:00:00Z" })).toBe(
      "2026-W44",
    );
  });
});

describe("normalizeCdnRecord", () => {
  test("maps snake_case CDN rows into normalized rows", () => {
    const row = normalizeCdnRecord(
      {
        period_key: "2026-10-28",
        rank: 1,
        score: 1720,
        full_name: "anhao/ai-pose-gallery-zh",
        github_url: "https://github.com/anhao/ai-pose-gallery-zh",
        description: "desc",
        language: "Python",
        stars_total: 515,
        stars_gained: 215,
        forks_total: 0,
        forks_gained: 0,
        created_at: "2026-10-27T12:24:37Z",
        tags: ["ai-agent"],
        social_mention_platforms: ["x"],
        timeframe: "daily",
        language_filter: "all",
      },
      "daily",
      "all",
    );
    expect(row.periodKey).toBe("2026-10-28");
    expect(row.fullName).toBe("anhao/ai-pose-gallery-zh");
    expect(row.githubUrl).toBe("https://github.com/anhao/ai-pose-gallery-zh");
    expect(row.starsGained).toBe(215);
    expect(row.tags).toEqual(["ai-agent"]);
    expect(row.socialMentionPlatforms).toEqual(["x"]);
    expect(row.timeframe).toBe("daily");
    expect(row.languageFilter).toBe("all");
  });

  test("synthesizes githubUrl when missing", () => {
    const row = normalizeCdnRecord({ full_name: "a/b" }, "daily", "all");
    expect(row.githubUrl).toBe("https://github.com/a/b");
    expect(row.rank).toBe(0);
    expect(row.score).toBeNull();
  });
});

describe("normalizeScrapedRecord", () => {
  test("maps trendshift.io initialData rows into normalized rows", () => {
    const row = normalizeScrapedRecord(
      {
        id: 1435695423,
        rank: 1,
        score: 4224,
        full_name: "anhao/ai-pose-gallery-zh",
        language: "Python",
        repository_id: 321871,
        repository_language: "Python",
        repository_description: "desc",
        repository_stars: 703,
        repository_forks: 0,
        repository_stars_gained: 528,
        repository_forks_gained: 0,
        repository_created_at: "2026-10-27T12:24:37Z",
        tags: [
          {
            id: 11,
            name: "ai-skills",
            display_name: "AI skills",
            slug: "ai-skills",
          },
        ],
        social_mention_platforms: ["reddit", "x"],
        like_count: 2,
        bookmark_count: 2,
        date: "2026-10-28T00:00:00Z",
      },
      "daily",
      "python",
    );
    expect(row.periodKey).toBe("2026-10-28");
    expect(row.description).toBe("desc");
    expect(row.starsTotal).toBe(703);
    expect(row.starsGained).toBe(528);
    expect(row.tags).toEqual(["ai-skills"]);
    expect(row.socialMentionPlatforms).toEqual(["reddit", "x"]);
    expect(row.languageFilter).toBe("python");
    expect(row.githubUrl).toBe("https://github.com/anhao/ai-pose-gallery-zh");
  });

  test("derives weekly period keys from year/week fields", () => {
    const row = normalizeScrapedRecord(
      {
        full_name: "a/b",
        rank: 1,
        year: 2026,
        week: 44,
        week_start: "2026-10-26T00:00:00Z",
      },
      "weekly",
      "rust",
    );
    expect(row.periodKey).toBe("2026-W44");
  });
});

describe("parseInitialData", () => {
  const payload = [
    {
      rank: 1,
      full_name: "a/b",
      repository_stars: 10,
      repository_stars_gained: 5,
      date: "2026-10-28T00:00:00Z",
      tags: [],
      social_mention_platforms: ["x"],
    },
    {
      rank: 2,
      full_name: "c/d",
      repository_stars: 20,
      repository_stars_gained: 1,
      date: "2026-10-28T00:00:00Z",
      tags: [],
      social_mention_platforms: [],
    },
  ];

  test("extracts the array from a plain flight body", () => {
    const body = `1:"$Sreact.fragment"\n0:{"q":"?language=Python","initialData":${JSON.stringify(payload)},"tail":"x"}\n`;
    const rows = parseInitialData(body);
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(2);
    expect(rows![0].full_name).toBe("a/b");
  });

  test("extracts the array from an escaped flight string row", () => {
    const inner = `{"initialData":${JSON.stringify(payload)}}`;
    const body = `1:"$Sreact.fragment"\n0:${JSON.stringify(inner)}\n`;
    const rows = parseInitialData(body);
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(2);
  });

  test("returns null when initialData is absent", () => {
    expect(parseInitialData('0:{"hello":"world"}')).toBeNull();
  });

  test("ignores braces inside JSON strings", () => {
    const tricky = [
      {
        rank: 1,
        full_name: "a/b",
        description: "has ] and } inside",
        date: "2026-10-28T00:00:00Z",
      },
    ];
    const body = `0:{"initialData":${JSON.stringify(tricky)}}`;
    const rows = parseInitialData(body);
    expect(rows).not.toBeNull();
    expect(rows![0].description).toBe("has ] and } inside");
  });
});

describe("mergeSliceRows", () => {
  const base = (over: Partial<TrendshiftRepo>): TrendshiftRepo => ({
    periodKey: "2026-10-28",
    rank: 1,
    score: 1,
    fullName: "a/b",
    githubUrl: "https://github.com/a/b",
    description: "",
    language: "Rust",
    starsTotal: 1,
    starsGained: 1,
    forksTotal: 0,
    forksGained: 0,
    createdAt: null,
    tags: [],
    socialMentionPlatforms: [],
    timeframe: "daily",
    languageFilter: "all",
    ...over,
  });

  test("keeps history rows and lets incoming rows win per (period, repo)", () => {
    const existing = [
      base({ periodKey: "2026-10-27", fullName: "a/b", starsGained: 10 }),
      base({ periodKey: "2026-10-28", fullName: "a/b", starsGained: 5 }),
    ];
    const incoming = [
      base({ periodKey: "2026-10-28", fullName: "a/b", starsGained: 7 }),
    ];
    const merged = mergeSliceRows(existing, incoming);
    expect(merged.length).toBe(2);
    const today = merged.find((r) => r.periodKey === "2026-10-28")!;
    expect(today.starsGained).toBe(7);
    expect(merged.some((r) => r.periodKey === "2026-10-27")).toBe(true);
  });

  test("sorts newest period first, then by rank", () => {
    const merged = mergeSliceRows(
      [base({ periodKey: "2026-10-26", rank: 1, fullName: "x/y" })],
      [
        base({ periodKey: "2026-10-28", rank: 2, fullName: "b/c" }),
        base({ periodKey: "2026-10-28", rank: 1, fullName: "a/b" }),
      ],
    );
    expect(merged.map((r) => `${r.periodKey}:${r.rank}`)).toEqual([
      "2026-10-28:1",
      "2026-10-28:2",
      "2026-10-26:1",
    ]);
  });
});
