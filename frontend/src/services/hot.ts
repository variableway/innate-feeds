/**
 * GitHub Hot client (GH #63). Dual-mode like services/topics.ts:
 *  - API mode:    GET /api/hot?limit=…, GET /api/hot/dates
 *  - static mode: GET {STATIC_BASE}/hot/manifest.json + hot-{date}.json
 */

import type { HotItem, HotSnapshotDTO } from "@/types/hot";
import { isStaticMode } from "./feeds";

const API_BASE = "/api";

const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");

const FETCH_TIMEOUT_MS = 15000;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function normalizeSignal(
  raw: Record<string, unknown>,
): HotItem["signals"][number] {
  return {
    source: str(raw.source) as HotItem["signals"][number]["source"],
    label: raw.label ? str(raw.label) : undefined,
    rank: numOrNull(raw.rank) ?? undefined,
    seenAt: str(raw.seenAt),
    weight: numOrNull(raw.weight) ?? 0,
  };
}

function normalizeItem(raw: Record<string, unknown>): HotItem {
  const fullName = str(raw.fullName);
  const ownerLogin = str(raw.ownerLogin) || fullName.split("/")[0] || "";
  const signals = Array.isArray(raw.signals)
    ? raw.signals
        .filter(
          (s): s is Record<string, unknown> => !!s && typeof s === "object",
        )
        .map(normalizeSignal)
    : [];
  return {
    fullName,
    heat: numOrNull(raw.heat) ?? 0,
    rank: numOrNull(raw.rank) ?? 0,
    stars: numOrNull(raw.stars),
    starsGained: numOrNull(raw.starsGained),
    description: raw.description ? str(raw.description) : null,
    language: raw.language ? str(raw.language) : null,
    ownerLogin,
    ownerAvatarUrl:
      str(raw.ownerAvatarUrl) || `https://github.com/${ownerLogin}.png`,
    signals,
    isNew: Boolean(raw.isNew),
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Latest hot snapshot. API mode honors `limit`; static mode serves a fixed 50. */
export async function getHotSnapshot(limit = 50): Promise<HotSnapshotDTO> {
  if (isStaticMode()) {
    const manifest = (await fetchJson(`${STATIC_BASE}/hot/manifest.json`)) as {
      snapshots?: { date: string }[];
    };
    const latest = manifest.snapshots?.[0]?.date;
    if (!latest) throw new Error("No hot snapshots in static manifest");
    const raw = await fetchJson(`${STATIC_BASE}/hot/hot-${latest}.json`);
    const r = raw as Record<string, unknown>;
    const items = Array.isArray(r.items)
      ? r.items
          .filter(
            (i): i is Record<string, unknown> => !!i && typeof i === "object",
          )
          .slice(0, limit)
          .map(normalizeItem)
      : [];
    return {
      snapshotDate: str(r.snapshotDate) || latest,
      ruleVersion: str(r.ruleVersion),
      generatedAt: str(r.generatedAt),
      items,
    };
  }
  const raw = (await fetchJson(`${API_BASE}/hot?limit=${limit}`)) as Record<
    string,
    unknown
  >;
  const items = Array.isArray(raw.items)
    ? raw.items
        .filter(
          (i): i is Record<string, unknown> => !!i && typeof i === "object",
        )
        .map(normalizeItem)
    : [];
  return {
    snapshotDate: str(raw.snapshotDate),
    ruleVersion: str(raw.ruleVersion),
    generatedAt: str(raw.generatedAt),
    items,
  };
}

/** Available snapshot dates, newest first (API mode only; static uses manifest). */
export async function getHotDates(): Promise<string[]> {
  if (isStaticMode()) {
    const manifest = (await fetchJson(`${STATIC_BASE}/hot/manifest.json`)) as {
      snapshots?: { date: string }[];
    };
    return (manifest.snapshots ?? []).map((s) => s.date);
  }
  const raw = (await fetchJson(`${API_BASE}/hot/dates`)) as unknown;
  return Array.isArray(raw) ? raw.map((d) => str(d)) : [];
}
