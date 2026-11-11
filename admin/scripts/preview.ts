/**
 * Serve the production build in admin/dist. Unmatched routes fall back to
 * index.html (SPA). /api/* is proxied to the Hono backend so `bun run preview`
 * works against a live backend without a separate dev server.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(adminRoot, "dist");
const PORT = Number(process.env.PORT || 4174);
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:4000";

if (!existsSync(join(distDir, "index.html"))) {
  console.error("✗ dist/index.html not found — run `bun run build` first.");
  process.exit(1);
}

async function proxyApi(req: Request): Promise<Response> {
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

Bun.serve({
  port: PORT,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    if (path.startsWith("/api/")) {
      return proxyApi(req);
    }
    // Windows: resolve() 返回反斜杠路径，统一为 posix 后再做前缀命中判断
    const root = resolve(distDir).replaceAll("\\", "/");
    const abs = resolve(root, `.${path}`).replaceAll("\\", "/");
    if (
      abs.startsWith(`${root}/`) &&
      existsSync(abs) &&
      statSync(abs).isFile()
    ) {
      return new Response(Bun.file(abs), {
        headers: { "cache-control": "no-cache" },
      });
    }
    return new Response(Bun.file(join(distDir, "index.html")), {
      headers: {
        "content-type": "text/html;charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  },
});

console.log(`▲ admin preview ready → http://localhost:${PORT}`);
console.log(`proxying /api/* → ${API_ORIGIN}`);
