/**
 * All-Bun dev server for the frontend, replacing the Vite dev server:
 *
 *   - serves the SPA at http://localhost:3000 (any unmatched route falls back
 *     to index.html)
 *   - proxies /api/* to the Hono backend on http://localhost:4000
 *   - rebuilds the JS bundle with Bun.build whenever src/ or ../shared changes
 *     (page auto-reloads via SSE)
 *   - recompiles CSS in-process with the Tailwind v4 engine
 *     (`@tailwindcss/node` + `@tailwindcss/oxide`, the API the official Vite
 *     plugin uses — `tailwindcss --watch` is not used); CSS-only changes
 *     hot-swap the stylesheet without a page reload
 *
 * Start the backend separately (`bun run dev:backend`) or via `bun run dev`.
 */
import { existsSync, statSync, watch } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(frontendRoot, "src");
const stylesPath = join(srcDir, "styles.css");
const sharedDir = resolve(frontendRoot, "../shared");
const publicDir = join(frontendRoot, "public");

const PORT = Number(process.env.PORT || 3000);
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:4000";

let jsCode = "";
let jsHash = "initial";
let cssCode = "";

/** Tailwind engine state, recreated when a .css source changes. */
let twCompiler: Awaited<ReturnType<typeof compile>> | null = null;
let twScanner: Scanner | null = null;
const twCandidates = new Set<string>();

type ReloadListener = (event: string, data?: string) => void;
const reloadListeners = new Set<ReloadListener>();

function broadcast(event: string, data = ""): void {
  for (const listener of reloadListeners) listener(event, data);
}

function log(...args: unknown[]): void {
  console.log(`[dev]`, ...args);
}

async function rebuildJS(): Promise<boolean> {
  const started = Date.now();
  const result = await Bun.build({
    entrypoints: [join(srcDir, "main.tsx")],
    target: "browser",
    format: "esm",
    minify: false,
    sourcemap: "linked",
    define: {
      "process.env.NODE_ENV": '"development"',
      "import.meta.env.BASE_URL": '"/"',
      "import.meta.env.VITE_STATIC_MODE": '"false"',
      "import.meta.env.VITE_STATIC_BASE": '""',
    },
  });
  if (!result.success) {
    const message = result.logs.map(String).join("\n");
    console.error(`[dev] ✗ JS build failed:\n${message}`);
    broadcast("build-error", message.slice(0, 2000));
    return false;
  }
  const entry = result.outputs.find((o) => o.kind === "entry-point");
  if (!entry) {
    console.error(`[dev] ✗ JS build produced no entry-point output`);
    return false;
  }
  const code = await entry.text();
  const changed = code !== jsCode;
  jsCode = code;
  jsHash = String(hashCode(code));
  log(
    `rebuilt JS in ${Date.now() - started}ms (${Math.ceil(code.length / 1024)} KiB)`,
  );
  return changed;
}

/** Compile the stylesheet. `fresh` recreates the Tailwind compiler (needed
 *  when a .css source changed); otherwise the oxide Scanner rescans only
 *  changed files incrementally. */
async function rebuildCSS(fresh: boolean): Promise<boolean> {
  const started = Date.now();
  try {
    if (fresh || !twCompiler || !twScanner) {
      twCompiler = await compile(await Bun.file(stylesPath).text(), {
        base: srcDir,
        onDependency: () => {},
      });
      const sources = (
        twCompiler.root === "none"
          ? []
          : twCompiler.root === null
            ? [{ base: frontendRoot, pattern: "**/*", negated: false }]
            : [{ ...twCompiler.root, negated: false }]
      ).concat(twCompiler.sources);
      twScanner = new Scanner({ sources });
    }
    for (const candidate of twScanner.scan()) twCandidates.add(candidate);
    const next = twCompiler.build([...twCandidates]);
    const changed = next !== cssCode;
    cssCode = next;
    log(
      `compiled CSS in ${Date.now() - started}ms (${Math.ceil(cssCode.length / 1024)} KiB)`,
    );
    return changed;
  } catch (error) {
    console.error(`[dev] ✗ CSS build failed:\n${error}`);
    broadcast("build-error", String(error).slice(0, 2000));
    return false;
  }
}

function hashCode(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return h;
}

/** Watch a directory (recursive) and report debounced changed filenames. */
function watchDirs(
  dirs: Array<{ dir: string; label: string }>,
  delayMs: number,
  onBatch: (files: Set<string>) => void,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<string>();
  for (const { dir, label } of dirs) {
    if (!existsSync(dir)) continue;
    watch(dir, { recursive: true }, (_event, filename) => {
      const file = filename ? String(filename) : "";
      if (file) pending.add(`${label}/${file}`);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const batch = new Set(pending);
        pending.clear();
        onBatch(batch);
      }, delayMs);
    });
  }
}

async function onChangeBatch(files: Set<string>): Promise<void> {
  log(`change detected: ${[...files].join(", ")}`);
  const cssChanged = [...files].some((f) => f.endsWith(".css"));
  const [jsChanged] = await Promise.all([rebuildJS(), rebuildCSS(cssChanged)]);
  if (jsChanged) {
    broadcast("reload");
  } else if (cssChanged) {
    broadcast("css");
  }
}

async function devHtml(): Promise<string> {
  const src = await Bun.file(join(frontendRoot, "index.html")).text();
  const devScriptTag = `<script type="module" src="/src/main.tsx"></script>`;
  if (!src.includes(devScriptTag) || !src.includes("</head>")) {
    throw new Error("index.html does not match the expected template");
  }
  return src
    .replace(
      "</head>",
      `    <link rel="stylesheet" href="/__dev_styles.css" />\n  </head>`,
    )
    .replace(
      devScriptTag,
      `    <script>
      (function () {
        var es = new EventSource("/__reload");
        es.addEventListener("reload", function () { location.reload(); });
        es.addEventListener("css", function () {
          var link = document.querySelector('link[rel="stylesheet"]');
          if (link) link.href = "/__dev_styles.css?v=" + Date.now();
        });
        es.addEventListener("build-error", function (e) {
          console.error("[dev] build error:\\n" + e.data);
        });
      })();
    </script>
    <script type="module" src="/__dev_main.js?v=${jsHash}"></script>`,
    );
}

function sseResponse(): Response {
  let send: ReloadListener = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(": hello\n\n"));
      send = (event, data = "") => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
          );
        } catch {
          reloadListeners.delete(send);
        }
      };
      reloadListeners.add(send);
      send("connected");
      heartbeat = setInterval(() => send("ping"), 15000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      reloadListeners.delete(send);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

async function proxyApi(req: Request, url: URL): Promise<Response> {
  const target = new URL(req.url);
  const origin = new URL(API_ORIGIN);
  target.protocol = origin.protocol;
  target.host = origin.host;
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers: req.headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }
  try {
    return await fetch(target, init);
  } catch (error) {
    return Response.json(
      { error: "backend unreachable", detail: String(error) },
      { status: 502 },
    );
  }
}

function publicFileFor(pathname: string): string | null {
  const root = resolve(publicDir);
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!rel) return null;
  const abs = resolve(root, rel);
  if (abs !== root && !abs.startsWith(`${root}/`)) return null;
  try {
    if (!statSync(abs).isFile()) return null;
  } catch {
    return null;
  }
  return abs;
}

async function main(): Promise<void> {
  await rebuildCSS(true);
  await rebuildJS();

  watchDirs(
    [
      { dir: srcDir, label: "src" },
      { dir: sharedDir, label: "shared" },
    ],
    150,
    (files) => {
      void onChangeBatch(files);
    },
  );

  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path.startsWith("/api/")) {
        return proxyApi(req, url);
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        return new Response("Not Found", { status: 404 });
      }
      if (path === "/__reload") {
        return sseResponse();
      }
      if (path === "/__dev_main.js") {
        return new Response(jsCode, {
          headers: {
            "content-type": "text/javascript;charset=utf-8",
            "cache-control": "no-store",
            etag: jsHash,
          },
        });
      }
      if (path === "/__dev_styles.css") {
        return new Response(cssCode, {
          headers: {
            "content-type": "text/css;charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }

      const publicFile = publicFileFor(path);
      if (publicFile) {
        return new Response(Bun.file(publicFile), {
          headers: { "cache-control": "no-store" },
        });
      }

      // SPA fallback
      return new Response(await devHtml(), {
        headers: {
          "content-type": "text/html;charset=utf-8",
          "cache-control": "no-store",
        },
      });
    },
  });

  log(`frontend dev server ready → http://localhost:${PORT}`);
  log(`proxying /api/* → ${API_ORIGIN}`);
  log(`JS changes reload the page; CSS-only changes hot-swap the stylesheet`);
}

await main();
