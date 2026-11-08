/**
 * GitHub Hot 评估脚本（GH #63 §8，两周观察期）。
 *
 * 每日 sync hot 后运行，输出五个自动可算指标 + 按 §8.3 阈值给出 verdict：
 *   1. baseline overlap  — hot top10 与当日 trending 快照重合度（30-70% 健康）
 *   2. multiSignalRatio  — top10/top50 中 ≥2 源命中占比（核心价值，应上升）
 *   3. decay check       — 前一日 top10 今日仍在 top50 的条数（半衰生效、非骤失）
 *   4. false-negative    — 当日 trending 仓库完全缺席 hot top50 的条数
 *   5. source health     — 各源今日贡献的信号数（管道健康）
 *
 * 只读分析，不写库；报告 JSON 落 ~/.innate/github-hot/eval-{date}.json。
 * 假阳性人工抽查（§8.1-4）无法自动判定，报告尾部打印抽查提示。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Database } from "bun:sqlite";
import { getHotSnapshot, getHotSnapshotDates } from "../db/index.js";

export interface HotEvalReport {
  date: string;
  generatedAt: string;
  snapshot: { date: string; items: number; ruleVersion: string };
  baselineOverlap10: { overlap: number; hotOnly: number; ratio: number } | null;
  multiSignalRatio: { top10: number; top50: number };
  decayCheck: { prevDate: string | null; survived: number; ofPrevTop: number };
  falseNegative: { trendingInHot: number; trendingTotal: number; missing: string[] };
  sourceHealth: Record<string, number>;
  verdicts: { check: string; status: "ok" | "warn" | "bad"; detail: string }[];
}

const INNATE_HOME = () =>
  process.env.INNATE_HOME || join(process.env.HOME || "", ".innate");

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

/** Pure metric computation (unit-testable). */
export function computeEval(args: {
  date: string;
  items: { fullName: string; heat: number; signals: { source: string }[] }[];
  prevItems: { fullName: string }[] | null;
  trendingFullNames: string[];
  trendingDate: string | null;
}): HotEvalReport {
  const { date, items, prevItems, trendingFullNames, trendingDate } = args;
  const hot10 = items.slice(0, 10).map((i) => i.fullName);
  const hot50Set = new Set(items.map((i) => i.fullName.toLowerCase()));

  // 1. baseline overlap: |hotTop10 ∩ trendingToday| vs trending size
  let baselineOverlap10: HotEvalReport["baselineOverlap10"] = null;
  if (trendingFullNames.length) {
    const tSet = new Set(trendingFullNames.map((n) => n.toLowerCase()));
    const overlap = hot10.filter((n) => tSet.has(n.toLowerCase())).length;
    baselineOverlap10 = {
      overlap,
      hotOnly: hot10.length - overlap,
      ratio: pct(overlap, Math.min(10, tSet.size)),
    };
  }

  // 2. multi-signal ratio
  const multi = (n: number) =>
    items.slice(0, n).filter((i) => new Set(i.signals.map((s) => s.source)).size >= 2).length;
  const multiSignalRatio = { top10: pct(multi(10), Math.min(10, items.length)), top50: pct(multi(50), items.length) };

  // 3. decay: prev top10 survivors in today's top50
  const prevTop = (prevItems ?? []).slice(0, 10);
  const survived = prevTop.filter((p) => hot50Set.has(p.fullName.toLowerCase())).length;

  // 4. false-negative proxy: trending repos absent from hot top50
  const missing = trendingFullNames.filter((n) => !hot50Set.has(n.toLowerCase()));

  // 5. source health across top50
  const sourceHealth: Record<string, number> = {};
  for (const item of items) {
    for (const s of new Set(item.signals.map((x) => x.source))) {
      sourceHealth[s] = (sourceHealth[s] ?? 0) + 1;
    }
  }

  const verdicts: HotEvalReport["verdicts"] = [];
  if (baselineOverlap10) {
    const r = baselineOverlap10.ratio;
    const status = r > 80 ? "bad" : r < 10 ? "bad" : "ok";
    verdicts.push({
      check: "baselineOverlap",
      status,
      detail: `hot top10 ∩ trending(${trendingDate}) = ${r}%（健康带 30-70%；>80% 复读 / <10% 单源主导）`,
    });
  } else {
    verdicts.push({ check: "baselineOverlap", status: "warn", detail: "当日无 trending 快照可比对" });
  }
  verdicts.push({
    check: "multiSignal",
    status: multiSignalRatio.top10 >= 20 ? "ok" : "warn",
    detail: `top10 多信号占比 ${multiSignalRatio.top10}%（目标 ≥20%，第一周偏低属预期）`,
  });
  verdicts.push({
    check: "decay",
    status: !prevItems ? "warn" : survived >= Math.min(3, prevTop.length) ? "ok" : "warn",
    detail: prevItems
      ? `昨日 top10 今日仍在前 50：${survived}/${prevTop.length}（骤失 = 半衰配置或窗口问题）`
      : "无前一日快照可比",
  });
  verdicts.push({
    check: "falseNegative",
    status: trendingFullNames.length === 0 ? "warn" : missing.length <= Math.ceil(trendingFullNames.length / 2) ? "ok" : "warn",
    detail: `trending ${trendingFullNames.length} 条中 ${missing.length} 条缺席 hot top50${missing.length ? `：${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " …" : ""}` : ""}`,
  });
  const health = Object.entries(sourceHealth).map(([k, v]) => `${k}:${v}`).join(" ");
  verdicts.push({
    check: "sourceHealth",
    status: Object.keys(sourceHealth).length >= 2 ? "ok" : "warn",
    detail: `top50 信号分布 ${health || "（空）"}；CI 快照只有 digest+trending 属预期（§8.4）`,
  });

  return {
    date,
    generatedAt: new Date().toISOString(),
    snapshot: { date, items: items.length, ruleVersion: "" },
    baselineOverlap10,
    multiSignalRatio,
    decayCheck: {
      prevDate: prevItems ? "" : null,
      survived,
      ofPrevTop: prevTop.length,
    },
    falseNegative: { trendingInHot: trendingFullNames.length - missing.length, trendingTotal: trendingFullNames.length, missing },
    sourceHealth,
    verdicts,
  };
}

/** CLI entry: read snapshots + trending, compute, print, persist report. */
export function evalHot(db: Database, dateArg?: string): HotEvalReport {
  const dates = getHotSnapshotDates(db);
  const date = dateArg || dates[0];
  if (!date) throw new Error("No hot snapshots — run `sync hot` first");
  const snapshot = getHotSnapshot(db, date, 50);
  if (!snapshot) throw new Error(`No hot snapshot for ${date}`);
  const prevDate = dates[dates.indexOf(date) + 1] ?? null;
  const prev = prevDate ? getHotSnapshot(db, prevDate, 50) : null;

  // trending baseline: newest daily snapshot on/before the eval date
  const trendingRow = db
    .prepare(
      `SELECT snapshot_date FROM trending_repos
       WHERE period = 'daily' AND snapshot_date <= ?
       ORDER BY snapshot_date DESC LIMIT 1`,
    )
    .get(date) as { snapshot_date: string } | undefined;
  let trendingFullNames: string[] = [];
  if (trendingRow) {
    trendingFullNames = (
      db
        .prepare(
          `SELECT full_name FROM trending_repos
           WHERE period = 'daily' AND snapshot_date = ?`,
        )
        .all(trendingRow.snapshot_date) as { full_name: string }[]
    ).map((r) => r.full_name);
  }

  const report = computeEval({
    date,
    items: snapshot.items.map((i) => ({ fullName: i.fullName, heat: i.heat, signals: i.signals })),
    prevItems: prev ? prev.items : null,
    trendingFullNames,
    trendingDate: trendingRow?.snapshot_date ?? null,
  });
  report.snapshot.ruleVersion = snapshot.ruleVersion;
  report.decayCheck.prevDate = prevDate;

  // persist to ~/.innate/github-hot/eval-{date}.json
  const dir = join(INNATE_HOME(), "github-hot");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `eval-${date}.json`), JSON.stringify(report, null, 2));

  // console summary
  const line = (v: HotEvalReport["verdicts"][number]) =>
    `${v.status === "ok" ? "✅" : v.status === "warn" ? "⚠️ " : "❌"} ${v.check}: ${v.detail}`;
  console.log(`[hot-eval] ${date} → ${join(dir, `eval-${date}.json`)}`);
  for (const v of report.verdicts) console.log(line(v));
  console.log(
    `[hot-eval] 人工抽查提醒（§8.1-4，无法自动判定）：从 top20 抽 5 条人工判断是否值得关注，记入观察日志`,
  );
  return report;
}
