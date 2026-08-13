import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";
import { TrendingPage } from "./page";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trending/$repoId",
  component: TrendingPage,
});
