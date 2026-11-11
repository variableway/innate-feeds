/**
 * Production build for the admin console (issue #70), mirroring
 * frontend/scripts/build.ts but API-mode only (no static data / Pages output):
 *
 *   1. CSS compiled in-process with the Tailwind v4 engine, minified + hashed.
 *   2. JS/TSX bundled by `Bun.build` into `dist/assets/` with content hashes.
 *   3. `index.html` assembled with hashed asset URLs (base `VITE_BASE_PATH`).
 */
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

const adminRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(adminRoot, "src");
const distDir = join(adminRoot, "dist");
const assetsDir = join(distDir, "assets");

const basePath = normalizeBasePath(process.env.VITE_BASE_PATH || "/");

function normalizeBasePath(base: string): string {
  if (base === "/") return "/";
  return `/${base.replace(/^\/+|\/+$/g, "")}/`;
}

function fail(message: string): never {
  console.error(`✗ admin build failed: ${message}`);
  process.exit(1);
}

/**
 * Compile src/styles.css with the Tailwind v4 engine. Mirrors what the
 * official @tailwindcss/vite plugin does: compile() parses `@import
 * "tailwindcss"` / `@source`, the oxide Scanner auto-detects candidate
 * classes from the project, and compiler.build() emits the CSS.
 */
export async function compileStylesheet(minify: boolean): Promise<string> {
  const inputPath = join(srcDir, "styles.css");
  const compiler = await compile(await Bun.file(inputPath).text(), {
    base: srcDir,
    onDependency: () => {},
  });
  const sources = (
    compiler.root === "none"
      ? []
      : compiler.root === null
        ? [{ base: adminRoot, pattern: "**/*", negated: false }]
        : [{ ...compiler.root, negated: false }]
  ).concat(compiler.sources);
  const scanner = new Scanner({ sources });
  const candidates = new Set<string>();
  for (const candidate of scanner.scan()) candidates.add(candidate);
  const css = compiler.build([...candidates]);
  return minify ? optimize(css, { minify: true }).code : css;
}

async function printSummary(): Promise<void> {
  const files: Array<{ path: string; size: number }> = [];
  async function walk(dir: string, prefix: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, rel);
      } else {
        files.push({ path: rel, size: (await stat(abs)).size });
      }
    }
  }
  await walk(distDir, "");
  const total = files.reduce((sum, f) => sum + f.size, 0);
  for (const f of files.sort((a, b) => b.size - a.size)) {
    console.log(
      `  ${String(Math.ceil(f.size / 1024)).padStart(6)} KiB  ${f.path}`,
    );
  }
  console.log(
    `  ${String(Math.ceil(total / 1024)).padStart(6)} KiB  total (${files.length} files)`,
  );
}

async function main(): Promise<void> {
  console.log(`▲ building admin console with Bun (base: ${basePath})`);

  await rm(distDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });

  // 1. CSS — compile with the Tailwind engine, then write with a hash.
  const css = await compileStylesheet(true);
  const cssHash = createHash("sha256").update(css).digest("hex").slice(0, 12);
  const cssName = `styles-${cssHash}.css`;
  await Bun.write(join(assetsDir, cssName), css);

  // 2. JS — single minified ESM bundle from src/main.tsx.
  const result = await Bun.build({
    entrypoints: [join(srcDir, "main.tsx")],
    target: "browser",
    format: "esm",
    minify: true,
    sourcemap: "none",
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.env.BASE_URL": JSON.stringify(basePath),
    },
    naming: {
      entry: "assets/[name]-[hash].[ext]",
      chunk: "assets/[name]-[hash].[ext]",
      asset: "assets/[name]-[hash].[ext]",
    },
  });
  if (!result.success) {
    fail(result.logs.map(String).join("\n"));
  }
  let jsName = "";
  for (const output of result.outputs) {
    const rel = output.path.replace(/^\.?\//, "");
    await Bun.write(join(distDir, rel), output);
    if (output.kind === "entry-point") jsName = rel;
  }
  if (!jsName) fail("Bun.build produced no entry-point output");

  // 3. index.html — swap the dev script tag for hashed production assets.
  const htmlSrc = await Bun.file(join(adminRoot, "index.html")).text();
  const devScriptTag = `<script type="module" src="/src/main.tsx"></script>`;
  if (!htmlSrc.includes(devScriptTag) || !htmlSrc.includes("</head>")) {
    fail("index.html does not match the expected template");
  }
  const html = htmlSrc
    .replace(
      "</head>",
      `    <link rel="stylesheet" href="${basePath}assets/${cssName}" />\n  </head>`,
    )
    .replace(
      devScriptTag,
      `<script type="module" src="${basePath}${jsName}"></script>`,
    );
  await Bun.write(join(distDir, "index.html"), html);

  // 4. Static public assets (optional).
  const publicDir = join(adminRoot, "public");
  if (existsSync(publicDir)) {
    await cp(publicDir, distDir, { recursive: true });
  }

  await printSummary();
  console.log("✓ admin build complete");
}

if (import.meta.main) {
  await main();
}
