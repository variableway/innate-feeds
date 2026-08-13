import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";
import { SettingsPage } from "./page";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});
