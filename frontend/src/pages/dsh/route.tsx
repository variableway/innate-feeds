import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";
import { DshPluginsPage } from "./page";

export type DshSearch = {
  q?: string;
  category?: string;
  sort?: string;
  view?: "grid" | "list";
  page?: number;
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dsh",
  validateSearch: (search: Record<string, unknown>): DshSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    view:
      search.view === "list" || search.view === "grid"
        ? search.view
        : undefined,
    page: Number(search.page) > 0 ? Number(search.page) : undefined,
  }),
  component: DshPluginsPage,
});
