import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";
import { DshCategoriesPage } from "./categories-page";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dsh/categories",
  component: DshCategoriesPage,
});
