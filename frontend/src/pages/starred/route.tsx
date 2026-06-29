import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";
import { StarredPage } from "./page";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/starred",
  component: StarredPage,
});
