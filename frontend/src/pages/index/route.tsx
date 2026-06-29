import { createRoute, Navigate } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";

function HomePage() {
  return <Navigate to="/trending" />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
