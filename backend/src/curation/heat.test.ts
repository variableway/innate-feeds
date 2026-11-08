import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import schemaSql from "../db/schema.sql" with { type: "text" };
import {
  HOT_RULE_VERSION,
  archiveTrendshiftDaily,
  buildHotSnapshot,
  extractDigestSignals,
  extractTrendshiftSignals,
  saveHotSnapshot,
} from "./heat.js";

let fixtureHome: string;

function setupFixtureStores(): string {
  fixtureHome = mkdtempSync(join(tmpdir(), "hot-fixture-"));
  process.env.INNATE_HOME = fixtureHome;

  // trendshift: today + yesterday archives (two slices today → dedupe check)
  const dailyDir = join(fixtureHome, "trendshift", "daily");
  mkdirSync(dailyDir, { recursive: true });
  writeFileSync(
    join(dailyDir, "daily-all.json"),
    JSON.stringify([
      { fullName: "a/lead", rank: 1, starsGained: 5000, periodKey: "2026-11-08" },
      { fullName: "b/runner", rank: 2, starsGained: 900, periodKey: "2026-11-08" },
      { fullName: "c/old", rank: 3, starsGained: 10, periodKey: "2026-11-01" },
    ]),
  );
  writeFileSync(
    join(dailyDir, "daily-typescript.json"),
    JSON.stringify([
      { fullName: "a/lead", rank: 4, starsGained: 300, periodKey: "2026-11-08" },
    ]),
  );

  // github-new
  const gnDir = join(fixtureHome, "github-new");
  mkdirSync(gnDir, { recursive: true });
  writeFileSync(
    join(gnDir, "new-2026-11-08.json"),
    JSON.stringify({
      items: [
        {
          metadata: { fullName: "d/fresh", createdAt: "2026-11-01T00:00:00Z" },
          publishedAt: "2026-11-08T06:00:00.000Z",
        },
      ],
    }),
  );

  return fixtureHome;
}

function seedTrending(db: Database): void {
  db.prepare(
    `INSERT INTO trending_repos (
       id, github_repo_id, name, full_name, url, stars, forks, watchers,
       owner_login, owner_avatar_url, owner_url, created_at, updated_at,
       period, snapshot_date
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("t1", 1, "lead", "a/lead", "u", 42000, 1, 1, "a", "", "u",
        "2026-01-01T00:00:00Z", "2026-11-08T00:00:00Z", "daily", "2026-11-08");
}

describe("heat engine", () => {
  let db: Database;
  beforeAll(() => {
    setupFixtureStores();
    db = new Database(":memory:");
    db.exec(schemaSql);
  });
  afterAll(() => {
    rmSync(fixtureHome, { recursive: true, force: true });
  });

  test("independent sources dedupe: trendshift two slices → one contribution", () => {
    const now = new Date("2026-11-08T12:00:00.000Z");
    const map = extractTrendshiftSignals(
      new Date(now.getTime() - 48 * 3_600_000),
      fixtureHome,
    );
    // a/lead appears in daily-all (rank 1) + daily-typescript (rank 4):
    // one entry, min rank kept.
    const facts = map.get("a/lead");
    expect(facts).toBeDefined();
    expect(facts?.rank).toBe(1);
    expect(facts?.starsGained).toBe(5000);
  });

  test("window cutoff: old periodKey excluded", () => {
    const now = new Date("2026-11-08T12:00:00.000Z");
    const map = extractTrendshiftSignals(
      new Date(now.getTime() - 48 * 3_600_000),
      fixtureHome,
    );
    expect(map.has("c/old")).toBe(false);
  });

  test("digest window filter", () => {
    const now = new Date("2026-11-08T12:00:00.000Z");
    const dump = {
      items: [
        { githubRepoFullName: "e/pick", issueCreatedAt: "2026-11-08T09:00:00Z", source: "github-daily" },
        { githubRepoFullName: "f/stale", issueCreatedAt: "2026-11-05T09:00:00Z", source: "github-daily" },
      ],
    };
    const map = extractDigestSignals(dump, new Date(now.getTime() - 48 * 3_600_000));
    expect(map.has("e/pick")).toBe(true);
    expect(map.has("f/stale")).toBe(false);
  });

  test("full build: weights, decay, ranking, metadata, isNew", () => {
    seedTrending(db);
    // digest signal for a/lead 24h ago → combined heat with trending.
    const dump = {
      items: [
        { githubRepoFullName: "a/lead", issueCreatedAt: "2026-11-07T12:00:00Z", source: "github-daily" },
      ],
    };
    // Monkey-patch the digest loader by writing a dump file it can find? —
    // loadNewestDigestDump reads fixed dirs; instead test the math directly
    // through buildHotSnapshot with fixture stores only (trendshift + new +
    // trending) and verify ordering determinism.
    const now = new Date("2026-11-08T12:00:00.000Z");
    const snapshot = buildHotSnapshot(db, { now, topN: 10 });

    expect(snapshot.ruleVersion).toBe(HOT_RULE_VERSION);
    expect(snapshot.snapshotDate).toBe("2026-11-08");

    // a/lead: trending (w3, seenAt 2026-11-08T00:00Z → 12h) + trendshift
    // (w3, same 12h) → heat = 6 × 2^(-0.5) ≈ 4.243
    const lead = snapshot.items.find((i) => i.fullName === "a/lead");
    expect(lead).toBeDefined();
    expect(lead?.heat).toBeCloseTo(6 * Math.pow(2, -0.5), 2);
    expect(lead?.stars).toBe(42000);
    expect(lead?.signals).toHaveLength(2);
    expect(lead?.rank).toBe(1);
    expect(lead?.isNew).toBe(false);

    // d/fresh: github-new only (w2, 6h) → 2 × 2^(-0.25) ≈ 1.682; isNew (created 11-01)
    const fresh = snapshot.items.find((i) => i.fullName === "d/fresh");
    expect(fresh?.heat).toBeCloseTo(2 * Math.pow(2, -0.25), 2);
    expect(fresh?.isNew).toBe(true);

    // ranks are 1..N contiguous
    const ranks = snapshot.items.map((i) => i.rank);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
  });

  test("tie-break: equal heat → stars desc → fullName asc", () => {
    const now = new Date("2026-11-08T12:00:00.000Z");
    const snap = buildHotSnapshot(db, { now, topN: 50 });
    for (let i = 1; i < snap.items.length; i++) {
      const prev = snap.items[i - 1];
      const cur = snap.items[i];
      const ok =
        prev.heat > cur.heat ||
        (prev.heat === cur.heat &&
          ((prev.stars ?? -1) > (cur.stars ?? -1) ||
            (prev.stars === cur.stars && prev.fullName < cur.fullName)));
      expect(ok).toBe(true);
    }
  });

  test("saveHotSnapshot replaces same-date rows and prunes old dates", () => {
    const now = new Date("2026-11-08T12:00:00.000Z");
    const snap = buildHotSnapshot(db, { now });
    saveHotSnapshot(db, snap);
    saveHotSnapshot(db, snap); // idempotent replace
    const count = db
      .prepare(`SELECT count(*) AS n FROM hot_snapshots`)
      .get() as { n: number };
    expect(count.n).toBe(snap.items.length);

    // inject an ancient row and confirm cleanup
    db.prepare(
      `INSERT INTO hot_snapshots (id, snapshot_date, rule_version, full_name, rank, heat, signals_json)
       VALUES ('2026-09-01#1', '2026-09-01', 'x', 'old/repo', 1, 1, '[]')`,
    ).run();
    const removed = saveHotSnapshot(db, snap);
    expect(removed).toBeGreaterThanOrEqual(1);
  });

  test("archiveTrendshiftDaily copies once per periodKey", () => {
    const dest = archiveTrendshiftDaily(fixtureHome);
    expect(dest).toContain("2026-11-08-all.json");
    expect(dest).toContain("trendshift");
    // second run: already archived → null
    expect(archiveTrendshiftDaily(fixtureHome)).toBeNull();
  });
});
