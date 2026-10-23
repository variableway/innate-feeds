import { createRoute, Navigate } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { createWebDomain } from "@innate/web-domain";
import { DomainLayout } from "./domain-layout";
import { TrendingPage } from "@/pages/trending/page";
import { StarredPage } from "@/pages/starred/page";
import { DigestPage } from "@/pages/digest/page";
import { SettingsPage } from "@/pages/settings/page";
import { AdminPage } from "@/pages/admin/page";
import { DshPluginsPage } from "@/pages/dsh/page";
import { DshCategoriesPage } from "@/pages/dsh/categories-page";
import { DshCategoryPage } from "@/pages/dsh/category-page";
import { DshPluginDetailPage } from "@/pages/dsh/detail-page";

import type { DshSearch } from "@/types/dsh";

type SearchRecord = Record<string, unknown>;

function parseDshSearch(search: SearchRecord): DshSearch {
  return {
    q: typeof search.q === "string" ? search.q : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    view:
      search.view === "list" || search.view === "grid"
        ? search.view
        : undefined,
    page: Number(search.page) > 0 ? Number(search.page) : undefined,
  };
}

function parseCategorySearch(
  search: SearchRecord,
): Omit<DshSearch, "category"> {
  const { category: _category, ...rest } = parseDshSearch(search);
  return rest;
}

/**
 * innate-feeds 的 domain 声明（轨道 A）。
 * 硬条件：包名 `@innate/domain-feeds` + 本模块 `export { webDomain }`。
 * 壳侧栏 / 首页 tile 走 capability，不携带本仓基础 UI。
 */
export const webDomain = createWebDomain("feeds")
  .addRoute("app", (parent: AnyRoute) => {
    const layout = createRoute({
      getParentRoute: () => parent,
      id: "feeds",
      component: DomainLayout,
    });

    const routes = [
      createRoute({
        getParentRoute: () => layout,
        path: "/",
        component: () => <Navigate to="/trending" />,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/trending",
        component: TrendingPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/trending/$repoId",
        component: TrendingPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/starred",
        component: StarredPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/starred/$repoId",
        component: StarredPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/digest",
        component: DigestPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/digest/$digestId",
        component: DigestPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/dsh",
        validateSearch: parseDshSearch,
        component: DshPluginsPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/dsh/categories",
        component: DshCategoriesPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/dsh/categories/$slug",
        validateSearch: parseCategorySearch,
        component: DshCategoryPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/dsh/plugins/$slug",
        component: DshPluginDetailPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/settings",
        component: SettingsPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/admin",
        component: AdminPage,
      }),
    ];

    return layout.addChildren(routes as never) as unknown as AnyRoute;
  })
  .addCapability("navItems", [
    {
      label: "Trending",
      path: "/trending",
      icon: "Github",
      order: 10,
      group: "GitHub",
    },
    {
      label: "Starred",
      path: "/starred",
      icon: "Star",
      order: 11,
      group: "GitHub",
    },
    {
      label: "Digest",
      path: "/digest",
      icon: "Newspaper",
      order: 20,
      group: "GitHub",
    },
    {
      label: "Plugins",
      path: "/dsh",
      icon: "Puzzle",
      order: 30,
      group: "DeepSeek Harness",
    },
    {
      label: "SQLite",
      path: "/admin",
      icon: "Database",
      order: 40,
      group: "Admin",
    },
  ])
  .addCapability("homeTile", {
    title: "Feeds",
    description: "GitHub Trending / Starred 与社区 Digest。",
    path: "/trending",
  })
  .build();
