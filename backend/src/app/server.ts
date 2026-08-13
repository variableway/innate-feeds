import { existsSync, statSync } from "fs";
import { join, resolve } from "path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  getDb,
  getFeedItems,
  getStats,
  getLanguages,
  getTrendingDates,
} from "../db/index.js";
import {
  syncTrending,
  syncAllTrending,
  syncStarred,
} from "../collector/sync.js";
import {
  fetchRepoReadme,
  type TrendingPeriod,
} from "../collector/github.js";
import {
  getDigestFeedItems,
  getDigestItemById,
} from "../data/digest-store.js";
import { getAppSettings, getProjectRoot } from "../data/app-config.js";
import { listCachedReadmes } from "../data/readme-cache.js";
import {
  buildAuthStatus,
  removePat,
  savePatFromBody,
} from "../auth/index.js";

const app = new Hono();

app.use("/*", cors());

/** Liveness probe (opens the database). */
app.get("/api/health", (c) => {
  try {
    getDb();
    return c.json({
      ok: true,
      host: process.env.HOST || null,
      port: parseInt(process.env.PORT || "4000", 10),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database unavailable";
    return c.json({ ok: false, error: message }, 503);
  }
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  const message =
    err instanceof Error ? err.message : "Internal server error";
  return c.json({ error: message }, 500);
});

const SYNC_BODY_SCHEMA = z.object({
  type: z.enum(["trending", "starred", "all-trending"]),
  period: z.enum(["daily", "weekly", "monthly"]).optional(),
  username: z
    .string()
    .regex(/^[\w.-]{1,39}$/)
    .optional(),
  force: z.boolean().optional(),
  days: z.number().int().positive().max(365).optional(),
});

app.get("/api/feeds", (c) => {
  try {
    const type = c.req.query("type") || "trending";
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || "20", 10);
    const search = c.req.query("search");
    const sort = c.req.query("sort");
    const order = c.req.query("order");

    if (type === "digest") {
      const hasPrimaryUrl =
        c.req.query("hasPrimaryUrl") === "1" ||
        c.req.query("hasPrimaryUrl") === "true";
      const result = getDigestFeedItems(
        {
          search: search || undefined,
          source: c.req.query("source") || undefined,
          category: c.req.query("category") || undefined,
          sort: sort || "created",
          order: order || "desc",
          hasPrimaryUrl: hasPrimaryUrl || undefined,
        },
        page,
        pageSize,
      );
      return c.json(result);
    }

    const db = getDb();
    const language = c.req.query("language");
    const topicsParam = c.req.query("topics");
    const topicLegacy = c.req.query("topic");
    const topics = topicsParam
      ? topicsParam
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : topicLegacy
        ? [topicLegacy]
        : undefined;
    const date = c.req.query("date");
    const starsMin = c.req.query("starsMin")
      ? parseInt(c.req.query("starsMin")!, 10)
      : undefined;
    const starsMax = c.req.query("starsMax")
      ? parseInt(c.req.query("starsMax")!, 10)
      : undefined;

    const result = getFeedItems(
      db,
      type,
      {
        language,
        topics,
        search,
        sort: sort || "stars",
        order: order || "desc",
        date,
        starsMin,
        starsMax,
      },
      page,
      pageSize,
    );
    return c.json({ ...result, page, pageSize });
  } catch (err) {
    console.error("Error in /api/feeds:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/feeds/digest/:id", (c) => {
  try {
    const id = c.req.param("id");
    const item = getDigestItemById(id);
    if (!item) {
      return c.json({ error: "Digest item not found" }, 404);
    }
    return c.json(item);
  } catch (err) {
    console.error("Error in /api/feeds/digest/:id:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/readmes", (c) => {
  try {
    return c.json({
      root: getAppSettings().readmesDir,
      items: listCachedReadmes(),
    });
  } catch (err) {
    console.error("Error in GET /api/readmes:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/repos/:owner/:repo/readme/download", async (c) => {
  try {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const readme = await fetchRepoReadme(owner, repo);
    const filename = `${owner}-${repo}.md`;
    c.header("Content-Type", "text/markdown; charset=utf-8");
    c.header(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    return c.body(readme.markdown);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message =
      err instanceof Error ? err.message : "Internal server error";
    if (status === 404) {
      return c.json({ error: message }, 404);
    }
    console.error("Error in GET /api/repos/:owner/:repo/readme/download:", err);
    return c.json({ error: message }, 502);
  }
});

app.get("/api/repos/:owner/:repo/readme", async (c) => {
  try {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const readme = await fetchRepoReadme(owner, repo);
    return c.json(readme);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message =
      err instanceof Error ? err.message : "Internal server error";
    if (status === 404) {
      return c.json({ error: message }, 404);
    }
    console.error("Error in /api/repos/:owner/:repo/readme:", err);
    return c.json({ error: message }, 502);
  }
});

app.get("/api/feeds/stats", (c) => {
  try {
    const db = getDb();
    return c.json(getStats(db));
  } catch (err) {
    console.error("Error in /api/feeds/stats:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/feeds/languages", (c) => {
  try {
    const db = getDb();
    return c.json(getLanguages(db));
  } catch (err) {
    console.error("Error in /api/feeds/languages:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/feeds/dates", (c) => {
  try {
    const db = getDb();
    return c.json(getTrendingDates(db));
  } catch (err) {
    console.error("Error in /api/feeds/dates:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

/** Auth status: gh CLI and whether a PAT is stored (never returns the token). */
app.get("/api/auth/status", (c) => {
  try {
    return c.json(buildAuthStatus());
  } catch (err) {
    console.error("Error in /api/auth/status:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

/** Store GitHub PAT encrypted at rest (ADR-D5). Body: { token }. */
app.put("/api/auth/pat", async (c) => {
  try {
    const body = await c.req.json();
    const result = savePatFromBody(body);
    if (!result.ok) {
      return c.json(
        { error: result.error, details: result.details },
        400,
      );
    }
    return c.json(result);
  } catch (err) {
    console.error("Error in PUT /api/auth/pat:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

app.delete("/api/auth/pat", (c) => {
  try {
    return c.json(removePat());
  } catch (err) {
    console.error("Error in DELETE /api/auth/pat:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/feeds/sync", async (c) => {
  const body = await c.req.json();
  const parsed = SYNC_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation error", details: parsed.error.issues },
      400,
    );
  }

  const { type, period, username, force, days } = parsed.data;

  if (type === "all-trending") {
    const result = await syncAllTrending();
    return c.json(result);
  }

  let synced = 0;
  if (type === "trending") {
    synced = await syncTrending((period as TrendingPeriod) || "daily");
  } else if (type === "starred") {
    synced = syncStarred(username, undefined, force, days);
  }

  return c.json({ synced });
});

/**
 * Serve the Vite production build (frontend/dist) from the same origin as /api.
 * Client routes like /trending fall back to index.html.
 */
function mountWebsite(app: Hono): string | null {
  const distDir = process.env.FRONTEND_DIST?.trim()
    ? resolve(process.env.FRONTEND_DIST.trim())
    : join(getProjectRoot(), "frontend/dist");
  const indexHtml = join(distDir, "index.html");
  if (!existsSync(indexHtml)) {
    return null;
  }

  const distRoot = resolve(distDir);

  const resolvePublicFile = (pathname: string): string | null => {
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const candidate = resolve(distRoot, relative);
    if (candidate !== distRoot && !candidate.startsWith(`${distRoot}/`)) {
      return null;
    }
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
    return indexHtml;
  };

  app.get("*", (c) => {
    const pathname = new URL(c.req.url).pathname;
    if (pathname.startsWith("/api")) {
      return c.json({ error: "Not found" }, 404);
    }
    const filePath = resolvePublicFile(pathname);
    if (!filePath) {
      return c.json({ error: "Not found" }, 404);
    }
    return new Response(Bun.file(filePath));
  });

  return distRoot;
}

const port = parseInt(process.env.PORT || "4000", 10);
/** Optional HOST (e.g. 0.0.0.0 in Docker); default is localhost. */
const hostname = process.env.HOST || undefined;
const listenLabel = hostname
  ? `http://${hostname}:${port}`
  : `http://localhost:${port}`;
const webRoot = mountWebsite(app);
console.log(`Feeds server running on ${listenLabel}`);
if (webRoot) {
  console.log(`Website: ${listenLabel}  (from ${webRoot})`);
} else {
  console.log(
    "Website: not mounted (run `bun run build` then restart to serve the UI here)",
  );
}
if (process.env.DB_PATH) {
  console.log(`DB_PATH=${process.env.DB_PATH}`);
}

Bun.serve({
  fetch: app.fetch,
  port,
  hostname,
});
