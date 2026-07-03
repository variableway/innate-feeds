import { serve } from "@hono/node-server";
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
import type { TrendingPeriod } from "../collector/github.js";

const app = new Hono();

app.use("/*", cors());

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
    const db = getDb();
    const type = c.req.query("type") || "trending";
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
    const search = c.req.query("search");
    const sort = c.req.query("sort") || "stars";
    const order = c.req.query("order") || "desc";
    const date = c.req.query("date");
    const starsMin = c.req.query("starsMin")
      ? parseInt(c.req.query("starsMin")!, 10)
      : undefined;
    const starsMax = c.req.query("starsMax")
      ? parseInt(c.req.query("starsMax")!, 10)
      : undefined;
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || "20", 10);

    const result = getFeedItems(
      db,
      type,
      { language, topics, search, sort, order, date, starsMin, starsMax },
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

const port = parseInt(process.env.PORT || "4000", 10);
console.log(`Feeds API server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
