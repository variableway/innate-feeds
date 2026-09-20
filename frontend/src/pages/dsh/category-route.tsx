import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root/route";
import { DshCategoryPage } from "./category-page";
import type { DshSearch } from "./route";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dsh/categories/$slug",
  validateSearch: (
    search: Record<string, unknown>,
  ): Omit<DshSearch, "category"> => ({
    q: typeof search.q === "string" ? search.q : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    view:
      search.view === "list" || search.view === "grid"
        ? search.view
        : undefined,
    page: Number(search.page) > 0 ? Number(search.page) : undefined,
  }),
  component: DshCategoryPage,
});
