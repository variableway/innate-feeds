/**
 * DSH plugin directory API（Hono 子应用，issue #13 抽离）。
 *
 * 挂载于 server.ts：`app.route("/", dshRouter)`。路由与响应结构迁移前
 * 逐字段等价（原 server.ts 内联路由），OpenAPI 文档见 app/openapi.ts。
 */
import { Hono } from "hono";
import {
  findPlugin,
  findRelatedPlugins,
  getPluginCategories,
  getPluginStats,
  searchPlugins,
} from "./catalog.js";

export const dshRouter = new Hono();

dshRouter.get("/api/plugins/stats", (c) => {
  try {
    return c.json(getPluginStats());
  } catch (err) {
    console.error("Error in /api/plugins/stats:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

dshRouter.get("/api/plugins/categories", (c) => {
  try {
    return c.json(getPluginCategories());
  } catch (err) {
    console.error("Error in /api/plugins/categories:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

dshRouter.get("/api/plugins", (c) => {
  try {
    const category = (c.req.query("category") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return c.json(
      searchPlugins({
        q: c.req.query("q") || undefined,
        category,
        sort: c.req.query("sort") || undefined,
        page: parseInt(c.req.query("page") || "1", 10),
        perPage: parseInt(c.req.query("perPage") || "35", 10),
      }),
    );
  } catch (err) {
    console.error("Error in /api/plugins:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

dshRouter.get("/api/plugins/:slug/related", (c) => {
  try {
    const plugin = findPlugin(c.req.param("slug"));
    if (!plugin) return c.json({ error: "Plugin not found" }, 404);
    return c.json(findRelatedPlugins(plugin));
  } catch (err) {
    console.error("Error in /api/plugins/:slug/related:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

dshRouter.get("/api/plugins/:slug", (c) => {
  try {
    const plugin = findPlugin(c.req.param("slug"));
    if (!plugin) return c.json({ error: "Plugin not found" }, 404);
    return c.json(plugin);
  } catch (err) {
    console.error("Error in /api/plugins/:slug:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});
