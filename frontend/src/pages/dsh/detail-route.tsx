import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";
import { DshPluginDetailPage } from "./detail-page";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dsh/plugins/$slug",
  component: DshPluginDetailPage,
});
