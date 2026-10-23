import { describe, expect, it } from "vitest";
import { validateReadOnlySql } from "./admin-db.js";

describe("validateReadOnlySql", () => {
  it("accepts plain SELECT", () => {
    expect(validateReadOnlySql("SELECT * FROM starred_repos")).toBeNull();
    expect(
      validateReadOnlySql("  select full_name, stars\nfrom starred_repos;\n"),
    ).toBeNull();
  });

  it("accepts WITH (CTE) queries", () => {
    expect(
      validateReadOnlySql(
        "WITH t AS (SELECT 1 AS x) SELECT x FROM t",
      ),
    ).toBeNull();
  });

  it("accepts commented SQL with trailing semicolon", () => {
    expect(
      validateReadOnlySql("-- get everything\nSELECT * FROM trending_repos -- row; hint\n;"),
    ).toBeNull();
  });

  it("rejects empty / comment-only input", () => {
    expect(validateReadOnlySql("")).not.toBeNull();
    expect(validateReadOnlySql("   ")).not.toBeNull();
    expect(validateReadOnlySql("-- nothing here")).not.toBeNull();
  });

  it("rejects multi-statement input", () => {
    expect(
      validateReadOnlySql("SELECT 1; DROP TABLE starred_repos"),
    ).not.toBeNull();
  });

  it("rejects write and schema statements", () => {
    for (const sql of [
      "UPDATE starred_repos SET stars = 0",
      "DELETE FROM starred_repos",
      "INSERT INTO starred_repos VALUES (1)",
      "DROP TABLE starred_repos",
      "CREATE TABLE x (id INTEGER)",
      "ATTACH DATABASE 'x.db' AS x",
      "PRAGMA journal_mode = DELETE",
      "VACUUM",
      "REPLACE INTO starred_repos SELECT * FROM starred_repos",
    ]) {
      expect(validateReadOnlySql(sql), sql).not.toBeNull();
    }
  });

  it("rejects non-SELECT openers even without forbidden keywords", () => {
    expect(validateReadOnlySql("EXPLAIN SELECT 1")).not.toBeNull();
  });
});
