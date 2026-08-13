import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";
import { DigestPage } from "./page";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/digest/$digestId",
  component: DigestPage,
});
