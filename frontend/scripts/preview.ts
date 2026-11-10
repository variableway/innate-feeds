/**
 * Serve the production build in frontend/dist — the Bun replacement for
 * `vite preview`. Unmatched routes fall back to index.html (SPA).
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(frontendRoot, "dist");
const PORT = Number(process.env.PORT || 4173);

if (!existsSync(join(distDir, "index.html"))) {
  console.error("✗ dist/index.html not found — run `bun run build` first.");
  process.exit(1);
}

Bun.serve({
  port: PORT,
  fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
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

console.log(`▲ preview server ready → http://localhost:${PORT}`);
