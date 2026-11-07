import { describe, expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseTar,
  pickCatalogFiles,
  validateSnapshot,
  writeSnapshot,
  type TarEntry,
} from "./dsh-catalog.js";

// ---------------------------------------------------------------------------
// Minimal tar builder for fixtures (ustar, no prefix needed for short names)
// ---------------------------------------------------------------------------

function tarHeader(
  name: string,
  size: number,
  type: "file" | "dir" = "file",
): Buffer {
  const buf = Buffer.alloc(512);
  buf.write(name.slice(0, 100), 0, 100, "utf8");
  buf.write("0000644\0", 100); // mode
  buf.write("0000000\0", 108); // uid
  buf.write("0000000\0", 116); // gid
  buf.write(size.toString(8).padStart(11, "0") + "\0", 124);
  buf.write("00000000000\0", 136); // mtime
  buf.write("        ", 148); // checksum placeholder (spaces)
  buf.write(type === "dir" ? "5" : "0", 156);
  buf.write("ustar\0", 257);
  buf.write("00", 263);
  let sum = 0;
  for (const byte of buf) sum += byte;
  buf.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return buf;
}

function tarEntry(
  name: string,
  content: string,
  type: "file" | "dir" = "file",
): Buffer {
  if (type === "dir")
    return tarHeader(name.endsWith("/") ? name : `${name}/`, 0, "dir");
  const data = Buffer.from(content, "utf8");
  const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
  data.copy(padded);
  return Buffer.concat([tarHeader(name, data.length), padded]);
}

function archive(entries: Buffer[]): Buffer {
  return Buffer.concat([...entries, Buffer.alloc(1024)]);
}

const TOP = "awesome-dsh-plugin-main";

function catalogArchive(
  opts: { plugins?: number; badStars?: boolean; extra?: Buffer[] } = {},
): Buffer {
  const n = opts.plugins ?? 600;
  const entries: Buffer[] = [
    tarEntry(`${TOP}/`, "", "dir"),
    tarEntry(`${TOP}/data/`, "", "dir"),
    tarEntry(`${TOP}/README.md`, "# not part of the catalog"),
    tarEntry(
      `${TOP}/data/stars.json`,
      opts.badStars ? "{not json" : '{"https://github.com/a/b": {"stars": 1}}',
    ),
    tarEntry(`${TOP}/data/screenshots.json`, "{}"),
    tarEntry(`${TOP}/data/added-dates.json`, "{}"),
    tarEntry(`${TOP}/data/downloads.json`, "{}"),
    tarEntry(`${TOP}/data/capabilities.json`, "{}"), // not consumed — must be dropped
  ];
  for (let i = 0; i < n; i++) {
    entries.push(
      tarEntry(
        `${TOP}/data/plugins/plugin-${String(i).padStart(4, "0")}.yml`,
        `url: https://github.com/o/r${i}\nname: P${i}\ncategory: agi\ndescription:\n  en: d\n`,
      ),
    );
  }
  entries.push(tarEntry(`${TOP}/site/index.html`, "<html/>"));
  return archive([...entries, ...(opts.extra ?? [])]);
}

describe("parseTar", () => {
  test("parses regular files and skips directories", () => {
    const entries = parseTar(
      archive([tarEntry("a/", "", "dir"), tarEntry("a/b.txt", "hello")]),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("a/b.txt");
    expect(entries[0].data.toString()).toBe("hello");
  });

  test("handles GNU longname entries", () => {
    const long = `${TOP}/data/plugins/${"x".repeat(120)}.yml`;
    const buf = archive([
      tarEntry(long, "content"), // builder truncates the stored name; parseTar must still get it via 'L'
      // tarEntry writes the long name via GNU 'L' when >100 chars:
    ]);
    // Build manually: tarEntry already truncates names >100 in header, so
    // construct the longname record the way GNU tar does.
    const nameData = Buffer.from(long, "utf8");
    const padded = Buffer.alloc(Math.ceil(nameData.length / 512) * 512);
    nameData.copy(padded);
    const longHeader = (() => {
      const buf = Buffer.alloc(512);
      buf.write("././@LongLink", 0, 100, "utf8");
      buf.write(nameData.length.toString(8).padStart(11, "0") + "\0", 124);
      buf.write("        ", 148);
      buf.write("L", 156);
      buf.write("ustar\0", 257);
      let sum = 0;
      for (const byte of buf) sum += byte;
      buf.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
      return buf;
    })();
    const truncated = tarEntry(long.slice(0, 99), "content");
    const full = Buffer.concat([longHeader, padded, truncated]);
    const entries = parseTar(archive([full]));
    expect(entries[0].path).toBe(long);
    expect(entries[0].data.toString()).toBe("content");
    expect(buf.length).toBeGreaterThan(0);
  });

  test("rejects invalid size field", () => {
    const header = tarHeader("a.txt", 3);
    header.write("zzzzzzzzzz\0", 124);
    expect(() => parseTar(archive([header]))).toThrow(/Invalid tar entry size/);
  });
});

describe("pickCatalogFiles", () => {
  test("keeps plugins + consumed JSON maps, drops everything else", () => {
    const snap = pickCatalogFiles(parseTar(catalogArchive({ plugins: 5 })));
    expect(snap.pluginCount).toBe(5);
    expect(
      [...snap.files.keys()].filter((k) => !k.startsWith("plugins/")).sort(),
    ).toEqual([
      "added-dates.json",
      "downloads.json",
      "screenshots.json",
      "stars.json",
    ]);
    expect(snap.files.has("capabilities.json")).toBe(false);
    expect(snap.files.get("plugins/plugin-0000.yml")!.toString()).toContain(
      "github.com",
    );
  });

  test("throws when no data/plugins dir exists", () => {
    const buf = archive([tarEntry(`${TOP}/README.md`, "x")]);
    expect(() => pickCatalogFiles(parseTar(buf))).toThrow(/No data\/plugins/);
  });
});

describe("validateSnapshot", () => {
  test("accepts a healthy snapshot", () => {
    const snap = pickCatalogFiles(parseTar(catalogArchive()));
    expect(() => validateSnapshot(snap)).not.toThrow();
  });

  test("rejects too-few plugins (truncated archive floor)", () => {
    const snap = pickCatalogFiles(parseTar(catalogArchive({ plugins: 10 })));
    expect(() => validateSnapshot(snap)).toThrow(
      /Suspicious upstream snapshot/,
    );
  });

  test("rejects malformed stars.json", () => {
    const snap = pickCatalogFiles(parseTar(catalogArchive({ badStars: true })));
    expect(() => validateSnapshot(snap)).toThrow(
      /stars\.json is not valid JSON/,
    );
  });
});

describe("writeSnapshot", () => {
  test("replaces plugins/ atomically and propagates removals", () => {
    const dir = mkdtempSync(join(tmpdir(), "dsh-snap-test-"));
    try {
      // Seed an old vendored copy with a plugin that no longer exists upstream
      const { mkdirSync, writeFileSync } =
        require("node:fs") as typeof import("node:fs");
      mkdirSync(join(dir, "plugins"), { recursive: true });
      writeFileSync(join(dir, "plugins/zzz-removed.yml"), "old");
      writeFileSync(join(dir, "stars.json"), "{}");

      const snap = pickCatalogFiles(parseTar(catalogArchive({ plugins: 3 })));
      const written = writeSnapshot(snap, dir);
      expect(written).toBe(snap.files.size);
      expect(existsSync(join(dir, "plugins/zzz-removed.yml"))).toBe(false);
      expect(readdirSync(join(dir, "plugins"))).toHaveLength(3);
      expect(
        JSON.parse(readFileSync(join(dir, "stars.json"), "utf8"))[
          "https://github.com/a/b"
        ].stars,
      ).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("does not touch the target on validation failure mid-write", () => {
    const dir = mkdtempSync(join(tmpdir(), "dsh-snap-test-"));
    try {
      const { mkdirSync, writeFileSync } =
        require("node:fs") as typeof import("node:fs");
      mkdirSync(join(dir, "plugins"), { recursive: true });
      writeFileSync(join(dir, "plugins/keep.yml"), "keep");
      writeFileSync(join(dir, "stars.json"), '{"old":1}');

      // Staging mismatch check fires before any target write: the snapshot
      // claims more plugins than its files map actually contains.
      const bad = {
        files: new Map([["plugins/a.yml", Buffer.from("x")]]),
        pluginCount: 5, // ≠ 1 staged file → mismatch → throw, no writes
        bytes: 1,
      } as const;
      expect(() => writeSnapshot(bad as never, dir)).toThrow(
        /Staging mismatch/,
      );
      expect(readFileSync(join(dir, "plugins/keep.yml"), "utf8")).toBe("keep");
      expect(readFileSync(join(dir, "stars.json"), "utf8")).toBe('{"old":1}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("syncDshCatalog (dry-run against live upstream)", () => {
  test.skipIf(process.env.CI !== undefined || !process.env.GH_TOKEN)(
    "fetches and validates the real catalog",
    async () => {
      const { syncDshCatalog } = await import("./dsh-catalog.js");
      const result = await syncDshCatalog({ dryRun: true });
      expect(result.plugins).toBeGreaterThan(500);
      expect(result.files).toBeGreaterThan(500);
      expect(result.dryRun).toBe(true);
    },
  );
});
