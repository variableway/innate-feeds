import { createRoute } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { createWebDomain } from "@innate/web-domain";
import { EduLayout } from "./domain-layout";
import { EduSkillsPage } from "./pages/page";
import { EduVideosPage } from "./pages/videos-page";
import { EduCategoriesPage } from "./pages/categories-page";
import type { EduSearch } from "./types/edu";

type SearchRecord = Record<string, unknown>;

/** URL search → EduSearch；非法值一律丢掉而不是透传给下游。 */
function parseEduSearch(search: SearchRecord): EduSearch {
  const relevance =
    search.relevance === "core" || search.relevance === "related"
      ? search.relevance
      : undefined;
  const page = Number(search.page);
  return {
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    category:
      typeof search.category === "string" && search.category
        ? search.category
        : undefined,
    relevance,
    sort:
      typeof search.sort === "string" && search.sort ? search.sort : undefined,
    page: Number.isFinite(page) && page > 0 ? page : undefined,
  };
}

/**
 * 教育动画垂直聚合域的 domain 声明（轨道 A）。
 * 硬条件：包名 `@innate/domain-edu-animate` + 本模块 `export { webDomain }`。
 * 路由用 `/edu` 前缀，与 feeds / dsh 域天然命名空间隔离。
 * datasource（采集 / API / 静态导出）在 backend/src/collector/edu-*.ts，不进本包。
 */
export const webDomain = createWebDomain("edu-animate")
  .addRoute("app", (parent: AnyRoute) => {
    const layout = createRoute({
      getParentRoute: () => parent,
      id: "edu-animate",
      component: EduLayout,
    });

    const routes = [
      createRoute({
        getParentRoute: () => layout,
        path: "/edu",
        validateSearch: parseEduSearch,
        component: EduSkillsPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/edu/videos",
        validateSearch: parseEduSearch,
        component: EduVideosPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/edu/categories",
        component: EduCategoriesPage,
      }),
    ];

    return layout.addChildren(routes as never) as unknown as AnyRoute;
  })
  .addCapability("navItems", [
    {
      label: "Edu Animate",
      path: "/edu",
      icon: "GraduationCap",
      order: 50,
      group: "Education",
    },
    {
      label: "Edu Videos",
      path: "/edu/videos",
      icon: "Clapperboard",
      order: 51,
      group: "Education",
    },
    {
      label: "Edu Categories",
      path: "/edu/categories",
      icon: "LayoutGrid",
      order: 52,
      group: "Education",
    },
  ])
  .addCapability("homeTile", {
    title: "Edu Animate",
    description: "教育动画制作：领域 SKILL 目录 + 教学视频参考。",
    path: "/edu",
  })
  .build();
