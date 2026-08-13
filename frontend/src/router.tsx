import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./pages/__root/route";
import { Route as indexRoute } from "./pages/index/route";
import { Route as trendingRoute } from "./pages/trending/route";
import { Route as trendingDetailRoute } from "./pages/trending/detail-route";
import { Route as starredRoute } from "./pages/starred/route";
import { Route as starredDetailRoute } from "./pages/starred/detail-route";
import { Route as digestRoute } from "./pages/digest/route";
import { Route as digestDetailRoute } from "./pages/digest/detail-route";
import { Route as settingsRoute } from "./pages/settings/route";

const routeTree = rootRoute.addChildren([
  indexRoute,
  trendingRoute,
  trendingDetailRoute,
  starredRoute,
  starredDetailRoute,
  digestRoute,
  digestDetailRoute,
  settingsRoute,
]);

// GitHub Pages project sites are served under /{repo}/ — Vite sets BASE_URL accordingly.
const basepath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createRouter({
  routeTree,
  ...(basepath ? { basepath } : {}),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
