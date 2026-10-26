import { createRoute } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { createWebDomain } from "@innate/web-domain";
import { DshLayout } from "./domain-layout";
import { DshPluginsPage } from "./pages/page";
import { DshCategoriesPage } from "./pages/categories-page";
import { DshCategoryPage } from "./pages/category-page";
import { DshPluginDetailPage } from "./pages/detail-page";

import type { DshSearch } from "./types/dsh";

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
 * DSH 插件目录的 domain 声明（轨道 A，issue #13 自 feeds 域拆出）。
 * 硬条件：包名 `@innate/domain-dsh` + 本模块 `export { webDomain }`。
 * 路由保留 `/dsh` 前缀：与 feeds 域同 router 挂载时天然命名空间隔离。
 * datasource（目录加载/API/静态导出）在 backend/src/dsh/，不进本包。
 */
export const webDomain = createWebDomain("dsh")
  .addRoute("app", (parent: AnyRoute) => {
    const layout = createRoute({
      getParentRoute: () => parent,
      id: "dsh",
      component: DshLayout,
    });

    const routes = [
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
    ];

    return layout.addChildren(routes as never) as unknown as AnyRoute;
  })
  .addCapability("navItems", [
    {
      label: "Plugins",
      path: "/dsh",
      icon: "Puzzle",
      order: 10,
      group: "DeepSeek Harness",
    },
  ])
  .addCapability("homeTile", {
    title: "DSH Plugins",
    description: "awesome-dsh-plugin 目录：搜索、分类与安装指引。",
    path: "/dsh",
  })
  .build();
