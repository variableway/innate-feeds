import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./pages/__root/route";
import { Route as indexRoute } from "./pages/index/route";
import { Route as trendingRoute } from "./pages/trending/route";
import { Route as starredRoute } from "./pages/starred/route";

const routeTree = rootRoute.addChildren([
  indexRoute,
  trendingRoute,
  starredRoute,
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
