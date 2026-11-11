import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  addRun,
  getRun,
  getRunLogPath,
  getTasksStoreDir,
  listRuns,
  listSchedules,
  markInterruptedRuns,
  newRunId,
  readRunLogTail,
  appendRunLog,
  updateRun,
  upsertSchedule,
  type TaskRun,
} from "./task-runs-store.js";
import { isScheduleDue } from "../app/task-runner.js";

let tempHome: string;
let prevHome: string | undefined;

function makeRun(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: newRunId(),
    jobId: "hackernews",
    status: "running",
    trigger: "manual",
    startedAt: new Date().toISOString(),
    logFile: getRunLogPath("placeholder"),
    ...overrides,
  };
}

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "innate-tasks-test-"));
  prevHome = process.env.INNATE_HOME;
  process.env.INNATE_HOME = tempHome;
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.INNATE_HOME;
  else process.env.INNATE_HOME = prevHome;
  rmSync(tempHome, { recursive: true, force: true });
});

describe("task-runs-store", () => {
  test("store dir follows INNATE_HOME", () => {
    expect(getTasksStoreDir()).toBe(join(tempHome, "admin", "tasks"));
  });

  test("add/list/get run round-trip (newest first)", () => {
    const a = makeRun({ id: "run-a" });
    const b = makeRun({ id: "run-b" });
    addRun(a);
    addRun(b);
    const runs = listRuns();
    expect(runs.map((r) => r.id)).toEqual(["run-b", "run-a"]);
    expect(getRun("run-a")?.jobId).toBe("hackernews");
    expect(getRun("missing")).toBeNull();
  });

  test("updateRun patches status and persists", () => {
    addRun(makeRun({ id: "run-c" }));
    updateRun("run-c", { status: "success", exitCode: 0 });
    expect(getRun("run-c")?.status).toBe("success");
    const onDisk = JSON.parse(
      readFileSync(join(getTasksStoreDir(), "runs.json"), "utf8"),
    ) as { runs: TaskRun[] };
    expect(onDisk.runs[0]?.exitCode).toBe(0);
  });

  test("markInterruptedRuns sweeps stale running records", () => {
    addRun(makeRun({ id: "run-r", status: "running" }));
    addRun(makeRun({ id: "run-s", status: "success" }));
    const count = markInterruptedRuns();
    expect(count).toBe(1);
    expect(getRun("run-r")?.status).toBe("interrupted");
    expect(getRun("run-s")?.status).toBe("success");
  });

  test("log append + tail read", () => {
    appendRunLog("run-log", "line-1\n");
    appendRunLog("run-log", "line-2\n");
    expect(readRunLogTail("run-log")).toBe("line-1\nline-2\n");
    expect(readRunLogTail("no-such-log")).toBe("");
    expect(existsSync(getRunLogPath("run-log"))).toBe(true);
  });

  test("upsertSchedule merges by jobId and defaults", () => {
    upsertSchedule("hackernews", { enabled: true, everyMinutes: 30 });
    upsertSchedule("hackernews", { everyMinutes: 60 });
    const schedules = listSchedules();
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      jobId: "hackernews",
      enabled: true,
      everyMinutes: 60,
    });
  });
});

describe("isScheduleDue", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");

  test("disabled schedule never due", () => {
    expect(
      isScheduleDue(
        { enabled: false, everyMinutes: 60, lastStartedAt: undefined },
        now,
      ),
    ).toBe(false);
  });

  test("never started → due", () => {
    expect(isScheduleDue({ enabled: true, everyMinutes: 60 }, now)).toBe(true);
  });

  test("interval elapsed → due; not elapsed → not due", () => {
    const due = isScheduleDue(
      {
        enabled: true,
        everyMinutes: 60,
        lastStartedAt: "2026-11-11T10:59:00Z",
      },
      now,
    );
    const notDue = isScheduleDue(
      {
        enabled: true,
        everyMinutes: 60,
        lastStartedAt: "2026-11-11T11:30:00Z",
      },
      now,
    );
    expect(due).toBe(true);
    expect(notDue).toBe(false);
  });
});
