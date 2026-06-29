import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
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

app.get("/api/feeds", (c) => {
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
});

app.get("/api/feeds/stats", (c) => {
  const db = getDb();
  return c.json(getStats(db));
});

app.get("/api/feeds/languages", (c) => {
  const db = getDb();
  return c.json(getLanguages(db));
});

app.get("/api/feeds/dates", (c) => {
  const db = getDb();
  return c.json(getTrendingDates(db));
});

app.post("/api/feeds/sync", async (c) => {
  const body = await c.req.json();
  const type = body.type || "trending";
  const period = body.period as TrendingPeriod;
  const username = body.username;

  if (type === "all-trending") {
    return c.json(await syncAllTrending());
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
