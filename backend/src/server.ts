import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  getDb,
  getFeedItems,
  getStats,
  getLanguages,
  getTrendingDates,
} from "./db/index.js";
import { syncTrending, syncAllTrending, syncStarred } from "./sync.js";
import type { TrendingPeriod } from "./github.js";

const app = new Hono();

app.use("/*", cors());

// GET /api/feeds - Get feed items with filtering
app.get("/api/feeds", (c) => {
  const db = getDb();

  const type = c.req.query("type") || "trending";
  const language = c.req.query("language");
  const topic = c.req.query("topic");
  const search = c.req.query("search");
  const sort = c.req.query("sort") || "stars";
  const order = c.req.query("order") || "desc";
  const date = c.req.query("date");
  const page = parseInt(c.req.query("page") || "1", 10);
  const pageSize = parseInt(c.req.query("pageSize") || "20", 10);

  const result = getFeedItems(
    db,
    type,
    { language, topic, search, sort, order, date },
    page,
    pageSize,
  );
  return c.json({ ...result, page, pageSize });
});

// GET /api/feeds/stats - Get feed statistics
app.get("/api/feeds/stats", (c) => {
  const db = getDb();
  const stats = getStats(db);
  return c.json(stats);
});

// GET /api/feeds/languages - Get available languages
app.get("/api/feeds/languages", (c) => {
  const db = getDb();
  const languages = getLanguages(db);
  return c.json(languages);
});

// GET /api/feeds/dates - Get available trending dates
app.get("/api/feeds/dates", (c) => {
  const db = getDb();
  const dates = getTrendingDates(db);
  return c.json(dates);
});

// POST /api/feeds/sync - Sync feeds from GitHub
app.post("/api/feeds/sync", async (c) => {
  const body = await c.req.json();
  const type = body.type || "trending";
  const period = body.period as TrendingPeriod;
  const username = body.username;

  if (type === "all-trending") {
    const result = await syncAllTrending();
    return c.json(result);
  }

  const force = body.force === true;
  const days = typeof body.days === "number" ? body.days : undefined;

  let synced = 0;
  if (type === "trending") {
    synced = await syncTrending(period || "daily");
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
