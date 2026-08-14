/**
 * Hidden ("deleted") items store.
 *
 * - API mode: persisted server-side via /api/feeds/hide; localStorage mirrors
 *   the ids so lists update even before the POST round-trip completes.
 * - Static mode: localStorage is the only writable store; the exported
 *   `hidden.json` (written at export time) is merged in read-only so live
 *   GitHub digest items can be filtered too.
 */

export type HiddenKind = "digest" | "repo";

interface HiddenData {
  digest: string[];
  repos: string[];
}

const STORAGE_KEY = "innate-feeds:hidden";

const API_BASE = "/api";
const STATIC_BASE =
  import.meta.env.VITE_STATIC_BASE ||
  `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");
const IS_STATIC = import.meta.env.VITE_STATIC_MODE === "true";

function normalizeId(kind: HiddenKind, id: string): string {
  const trimmed = id.trim();
  return kind === "repo" ? trimmed.toLowerCase() : trimmed;
}

function loadLocalHidden(): HiddenData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { digest: [], repos: [] };
    const parsed = JSON.parse(raw) as Partial<HiddenData>;
    return {
      digest: Array.isArray(parsed.digest) ? parsed.digest : [],
      repos: Array.isArray(parsed.repos) ? parsed.repos : [],
    };
  } catch {
    return { digest: [], repos: [] };
  }
}

function saveLocalHidden(data: HiddenData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable — keep the change server-side only
  }
}

let exportedHiddenPromise: Promise<HiddenData> | null = null;

/** Static mode only: hidden list shipped by the last export. */
function loadExportedHidden(): Promise<HiddenData> {
  if (!exportedHiddenPromise) {
    exportedHiddenPromise = fetch(`${STATIC_BASE}/hidden.json`)
      .then((res) => (res.ok ? res.json() : { digest: [], repos: [] }))
      .then((data: Partial<HiddenData>) => ({
        digest: Array.isArray(data.digest) ? data.digest : [],
        repos: Array.isArray(data.repos) ? data.repos : [],
      }))
      .catch(() => ({ digest: [], repos: [] }));
  }
  return exportedHiddenPromise;
}

export async function getHiddenSets(): Promise<{
  digest: Set<string>;
  repos: Set<string>;
}> {
  const local = loadLocalHidden();
  const digest = new Set(local.digest);
  const repos = new Set(local.repos);
  if (IS_STATIC) {
    const exported = await loadExportedHidden();
    for (const id of exported.digest) digest.add(id);
    for (const name of exported.repos) repos.add(name);
  }
  return { digest, repos };
}

async function postHidden(
  endpoint: "hide" | "unhide",
  kind: HiddenKind,
  id: string,
) {
  try {
    const res = await fetch(`${API_BASE}/feeds/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    });
    if (!res.ok) {
      console.warn(`Failed to ${endpoint} item server-side: ${res.statusText}`);
    }
  } catch (err) {
    console.warn(`Failed to ${endpoint} item server-side:`, err);
  }
}

export async function hideItem(kind: HiddenKind, id: string): Promise<void> {
  const key = normalizeId(kind, id);
  if (!key) return;
  const local = loadLocalHidden();
  const list = kind === "repo" ? local.repos : local.digest;
  if (!list.includes(key)) {
    list.push(key);
    saveLocalHidden(local);
  }
  if (!IS_STATIC) {
    await postHidden("hide", kind, id);
  }
}

export async function unhideItem(kind: HiddenKind, id: string): Promise<void> {
  const key = normalizeId(kind, id);
  const local = loadLocalHidden();
  if (kind === "repo") {
    local.repos = local.repos.filter((r) => r !== key);
  } else {
    local.digest = local.digest.filter((d) => d !== key);
  }
  saveLocalHidden(local);
  if (!IS_STATIC) {
    await postHidden("unhide", kind, id);
  }
}
