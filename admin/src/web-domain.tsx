import { createRoute, Navigate } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { createWebDomain } from "@innate/web-domain";
import { DomainLayout } from "./domain-layout";
import { TasksPage } from "@/pages/tasks/page";
import { SqlitePage } from "@/pages/sqlite/page";

/** 根路径 → 任务面板（独立宿主与插件态同一入口）。 */
function AdminIndexRedirect() {
  return <Navigate to="/admin/tasks" />;
}

/**
 * 后台管理域声明（issue #70，轨道 A）。
 * 硬条件：包名 `@innate/domain-admin` + 本模块 `export { webDomain }`。
 * 两个业务页：/admin/tasks 采集任务后台、/admin/sqlite SQLite 工作台
 * （自 frontend 迁入）。
 */
export const webDomain = createWebDomain("admin")
  .addRoute("app", (parent: AnyRoute) => {
    const layout = createRoute({
      getParentRoute: () => parent,
      id: "admin",
      component: DomainLayout,
    });

    const routes = [
      createRoute({
        getParentRoute: () => layout,
        path: "/",
        component: AdminIndexRedirect,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/admin",
        component: AdminIndexRedirect,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/admin/tasks",
        component: TasksPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/admin/sqlite",
        component: SqlitePage,
      }),
    ];

    return layout.addChildren(routes as never) as unknown as AnyRoute;
  })
  .addCapability("navItems", [
    {
      label: "采集任务",
      path: "/admin/tasks",
      icon: "ListChecks",
      order: 10,
    },
    {
      label: "SQLite",
      path: "/admin/sqlite",
      icon: "Database",
      order: 20,
    },
  ])
  .build();
