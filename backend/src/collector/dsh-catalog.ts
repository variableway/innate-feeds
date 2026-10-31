/**
 * Refresh the vendored awesome-dsh-plugin catalog (issue #27).
 *
 * `awesome/awesome-dsh-plugin/data` is a committed snapshot of the upstream
 * catalog (https://github.com/awesome-dsh-plugin/awesome-dsh-plugin). The
 * upstream repo refreshes `data/` (stars/screenshots/added-dates + plugin
 * YAMLs) nightly via its own workflows, so syncing here means: download one
 * upstream tarball, keep only the files `backend/src/dsh/catalog.ts` consumes
 * (`plugins/*.yml`, `stars.json`, `screenshots.json`, `added-dates.json`,
 * `downloads.json`), validate, and atomically replace the vendored copy.
 *
 * Alternatives considered (research, issue #27):
 * - npm package `dsh-plugin-catalog` (daily): different schema — no
 *   screenshots (detail pages need them), extra capability fields; remapping
 *   would lose data.
 * - per-file contents API: 2700+ requests, unusable. One tarball is a single
 *   request (same approach as the trendshift CDN archives).
 */
import { gunzipSync } from "node:zlib";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { getProjectRoot } from "../data/app-config.js";

export const DSH_CATALOG_REPO = "awesome-dsh-plugin/awesome-dsh-plugin";
export const DSH_CATALOG_REF = "main";

const USER_AGENT =
  "innate-feeds/0.1 (+https://github.com/variableway/innate-feeds)";

/** Files under upstream `data/` that the vendored snapshot keeps. */
const CATALOG_FILES = [
  "stars.json",
  "screenshots.json",
  "added-dates.json",
  "downloads.json",
];

/**
 * Floor below which a parsed tarball is rejected instead of written: a
 * truncated/failed download must never wipe the committed snapshot. Upstream
 * lists ~2700 plugins; 500 leaves room for upstream pruning without silently
 * accepting a broken payload.
 */
const MIN_PLUGIN_FILES = 500;

export interface TarEntry {
  path: string;
  data: Buffer;
  type: string;
}

export interface CatalogSnapshot {
  /** relative path under `data/` (e.g. `plugins/foo.yml`, `stars.json`) */
  files: Map<string, Buffer>;
  pluginCount: number;
  bytes: number;
}

export interface DshCatalogSyncResult {
  repo: string;
  ref: string;
  plugins: number;
  files: number;
  bytes: number;
  dataDir: string;
  dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Tar parsing (ustar + GNU longname + pax path records — enough for the
// GNU/ustar tarballs codeload.github.com serves; no external dep).
// ---------------------------------------------------------------------------

function octalToNumber(buf: Buffer): number {
  const raw = buf.toString("utf8").replace(/\0.*$/, "").trim();
  if (!raw) return 0;
  const n = parseInt(raw, 8);
  return Number.isNaN(n) ? -1 : n;
}

function readString(buf: Buffer): string {
  const end = buf.indexOf(0);
  return buf.toString("utf8", 0, end === -1 ? buf.length : end);
}

/**
 * Parse an uncompressed tar buffer into path→data entries. Directories,
 * symlinks and pax/global headers are skipped (pax `path` records and GNU
 * longname entries override the next header's path, which matters once
 * `data/plugins/<file>.yml` exceeds the 100-byte name field).
 */
export function parseTar(buf: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let pendingName: string | null = null;
  let paxPath: string | null = null;

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break; // end-of-archive

    let name = readString(header.subarray(0, 100));
    const size = octalToNumber(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 0);
    const prefix = readString(header.subarray(345, 500));
    if (prefix) name = `${prefix}/${name}`;
    if (paxPath) {
      name = paxPath;
      paxPath = null;
    }
    if (pendingName) {
      name = pendingName;
      pendingName = null;
    }

    offset += 512;
    if (size < 0) throw new Error("Invalid tar entry size");
    const data = buf.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    if (type === "L") {
      // GNU long name for the next entry
      pendingName = readString(data as Buffer);
      continue;
    }
    if (type === "x" || type === "X") {
      // pax extended header: "<len> path=<value>\n" records
      const text = (data as Buffer).toString("utf8");
      const match = text.match(/(?:^|\n)\d+ path=([^\n]+)/);
      if (match) paxPath = match[1];
      continue;
    }
    if (type === "g") continue; // pax global header
    if (type === "5") continue; // directory
    if (type !== "0" && type !== "\0" && type !== "7") continue; // not a regular file

    entries.push({ path: name, data: Buffer.from(data), type });
  }
  return entries;
}

/**
 * Keep only the catalog-relevant files from a parsed upstream tarball.
 * `data/` must sit directly under the (single) top-level `{repo}-{ref}/`
 * directory GitHub prepends.
 */
export function pickCatalogFiles(entries: TarEntry[]): CatalogSnapshot {
  const dataPrefixes = new Set<string>();
  for (const entry of entries) {
    const m = entry.path.match(/^([^/]+)\/data\/plugins\/.+\.yml$/);
    if (m) dataPrefixes.add(m[1]);
  }
  const top = [...dataPrefixes][0];
  if (!top) {
    throw new Error("No data/plugins/*.yml found in upstream tarball");
  }

  const files = new Map<string, Buffer>();
  let pluginCount = 0;
  let bytes = 0;
  const wanted = new RegExp(
    `^${top}/data/(plugins/[^/]+\\.yml|${CATALOG_FILES.map((f) => f.replace(".", "\\.")).join("|")})$`,
  );
  for (const entry of entries) {
    const m = entry.path.match(wanted);
    if (!m) continue;
    const rel = m[1];
    files.set(rel, entry.data);
    bytes += entry.data.length;
    if (rel.startsWith("plugins/")) pluginCount++;
  }
  return { files, pluginCount, bytes };
}

/**
 * Reject payloads that would leave the vendored snapshot unusable: too few
 * plugin YAMLs, or a stars/screenshots/dates map that no longer parses as
 * JSON. Existing committed data stays untouched on any validation error.
 */
export function validateSnapshot(snapshot: CatalogSnapshot): void {
  if (snapshot.pluginCount < MIN_PLUGIN_FILES) {
    throw new Error(
      `Suspicious upstream snapshot: only ${snapshot.pluginCount} plugin files (min ${MIN_PLUGIN_FILES})`,
    );
  }
  for (const name of CATALOG_FILES) {
    const file = snapshot.files.get(name);
    if (!file) continue; // optional; vendored copy keeps its old version
    try {
      JSON.parse(file.toString("utf8"));
    } catch (err) {
      throw new Error(
        `${name} is not valid JSON: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Download + sync
// ---------------------------------------------------------------------------

function tarballUrl(ref: string): string {
  return `https://codeload.github.com/${DSH_CATALOG_REPO}/tar.gz/refs/heads/${ref}`;
}

export async function fetchCatalogTarball(
  ref: string = DSH_CATALOG_REF,
): Promise<Buffer> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  const token =
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(tarballUrl(ref), {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${tarballUrl(ref)}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

export function getVendoredDataDir(): string {
  if (process.env.DSH_PLUGIN_DATA_DIR?.trim()) {
    return resolve(process.env.DSH_PLUGIN_DATA_DIR.trim());
  }
  return resolve(getProjectRoot(), "awesome/awesome-dsh-plugin/data");
}

/**
 * Write the snapshot into a temp dir first, then swap directories, so a crash
 * mid-write never leaves the vendored copy half-replaced. The whole
 * `plugins/` dir is replaced (not merged) so upstream removals propagate.
 */
export function writeSnapshot(
  snapshot: CatalogSnapshot,
  dataDir: string,
): number {
  const staging = mkdtempSync(join(tmpdir(), "dsh-catalog-"));
  try {
    mkdirSync(join(staging, "plugins"), { recursive: true });
    for (const [rel, data] of snapshot.files) {
      const dest = join(staging, rel);
      writeFileSync(dest, data);
    }
    // Everything must have landed in staging before anything is replaced.
    const stagedPlugins = readdirSync(join(staging, "plugins")).filter((f) =>
      f.endsWith(".yml"),
    ).length;
    if (stagedPlugins !== snapshot.pluginCount) {
      throw new Error(
        `Staging mismatch: wrote ${stagedPlugins} plugin files, expected ${snapshot.pluginCount}`,
      );
    }

    rmSync(join(dataDir, "plugins"), { recursive: true, force: true });
    mkdirSync(dataDir, { recursive: true });
    // `renameSync` across filesystems (tmp → repo) can fail; copy contents
    // file-by-file instead — already validated above.
    for (const rel of snapshot.files.keys()) {
      if (rel.startsWith("plugins/")) {
        mkdirSync(join(dataDir, "plugins"), { recursive: true });
      }
      copyFileSync(join(staging, rel), join(dataDir, rel));
    }
    return snapshot.files.size;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Live metadata overlay (npm dsh-plugin-catalog)
// ---------------------------------------------------------------------------

interface CatalogPlugin {
  url?: string;
  stars?: number | null;
  added?: string | null;
}

interface CatalogPayload {
  updated?: string;
  plugins?: CatalogPlugin[];
}

/**
 * The git-committed `stars.json` / `added-dates.json` are a floor upstream
 * refreshes only from its Actions cache (measured: max `checkedAt` 2026-09-04
 * while the npm catalog updated 2026-10-30). The daily-published npm package
 * `dsh-plugin-catalog` carries the fresh numbers, so overlay it on top of the
 * tarball snapshot: update stars where checked more recently, and fill
 * added-dates for entries the committed map never had.
 */
export async function overlayNpmMetadata(snapshot: CatalogSnapshot): Promise<{
  starsUpdated: number;
  datesFilled: number;
  catalogDate: string | null;
}> {
  const tarball = await fetchNpmCatalogTarball();
  if (!tarball) return { starsUpdated: 0, datesFilled: 0, catalogDate: null };

  const entries = parseTar(tarball);
  const pluginsFile = entries.find(
    (e) =>
      /(?:^|\/)plugins\.json$/.test(e.path) &&
      basename(e.path) === "plugins.json",
  );
  if (!pluginsFile) {
    throw new Error("plugins.json missing from dsh-plugin-catalog tarball");
  }
  const payload = JSON.parse(
    pluginsFile.data.toString("utf8"),
  ) as CatalogPayload;

  const stars = JSON.parse(
    (snapshot.files.get("stars.json") ?? Buffer.from("{}")).toString("utf8"),
  ) as Record<string, { stars: number; checkedAt: string }>;
  const dates = JSON.parse(
    (snapshot.files.get("added-dates.json") ?? Buffer.from("{}")).toString(
      "utf8",
    ),
  ) as Record<string, string>;

  const checkedAt = (
    payload.updated ?? new Date().toISOString().slice(0, 10)
  ).slice(0, 10);
  let starsUpdated = 0;
  let datesFilled = 0;
  const repoUrl = (url: string) => url.replace(/\/+$/, "").toLowerCase();

  for (const plugin of payload.plugins ?? []) {
    if (typeof plugin.url !== "string") continue;
    const key = repoUrl(plugin.url);
    if (typeof plugin.stars === "number") {
      const existing = stars[key];
      if (!existing || existing.checkedAt < checkedAt) {
        stars[key] = { stars: plugin.stars, checkedAt };
        starsUpdated++;
      }
    }
    if (typeof plugin.added === "string" && plugin.added && !dates[key]) {
      dates[key] = plugin.added;
      datesFilled++;
    }
  }

  snapshot.files.set(
    "stars.json",
    Buffer.from(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(stars).sort(([a], [b]) => a.localeCompare(b)),
        ),
        null,
        1,
      ) + "\n",
    ),
  );
  snapshot.files.set(
    "added-dates.json",
    Buffer.from(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)),
        ),
        null,
        1,
      ) + "\n",
    ),
  );
  return { starsUpdated, datesFilled, catalogDate: payload.updated ?? null };
}

async function fetchNpmCatalogTarball(): Promise<Buffer | null> {
  const registry =
    process.env.DSH_CATALOG_NPM_REGISTRY?.trim() ||
    "https://registry.npmjs.org";
  let dist: { tarball: string } | null = null;
  try {
    const res = await fetch(`${registry}/dsh-plugin-catalog/latest`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const meta = (await res.json()) as { dist?: { tarball?: string } };
      if (typeof meta.dist?.tarball === "string") {
        dist = { tarball: meta.dist.tarball };
      }
    } else {
      console.warn(
        `[dsh-catalog] npm registry returned HTTP ${res.status} — keeping git floor metadata`,
      );
    }
  } catch (err) {
    console.warn(
      `[dsh-catalog] npm registry unreachable — keeping git floor metadata:`,
      err instanceof Error ? err.message : err,
    );
  }
  if (!dist) return null;

  const res = await fetch(dist.tarball, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${dist.tarball}`);
  const gzip = Buffer.from(await res.arrayBuffer());
  // npm registry tarballs are a single gzip member → the response is already
  // the whole gzipped tar; codeload-style double-gzip does not occur here.
  return gunzipSync(gzip);
}

export async function syncDshCatalog(
  opts: { ref?: string; dataDir?: string; dryRun?: boolean } = {},
): Promise<DshCatalogSyncResult> {
  const ref = opts.ref ?? DSH_CATALOG_REF;
  const dataDir = resolve(opts.dataDir ?? getVendoredDataDir());
  const gzip = await fetchCatalogTarball(ref);
  const tar = gunzipSync(gzip);
  const snapshot = pickCatalogFiles(parseTar(tar));
  validateSnapshot(snapshot);

  const overlay = await overlayNpmMetadata(snapshot);
  if (overlay.catalogDate) {
    console.log(
      `[dsh-catalog] npm overlay (${overlay.catalogDate}): ${overlay.starsUpdated} stars updated, ${overlay.datesFilled} added-dates filled`,
    );
  }

  if (!opts.dryRun) writeSnapshot(snapshot, dataDir);

  return {
    repo: DSH_CATALOG_REPO,
    ref,
    plugins: snapshot.pluginCount,
    files: snapshot.files.size,
    bytes: snapshot.bytes,
    dataDir,
    dryRun: Boolean(opts.dryRun),
  };
}
