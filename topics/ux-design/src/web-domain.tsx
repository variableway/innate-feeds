import { createRoute, Outlet } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { createWebDomain } from "@innate/web-domain";
import { UxDesignPage } from "./pages/page";

function UxDesignLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <main className="flex min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * UI/UX Design 主题域（sprint-3 B10）。
 * 「主题」组第二个入驻域（Education 之后）；数据来自 github-topics 采集的
 * UI/UX 主题快照（backend UX_DESIGN_TOPICS → /api/topics/:topic，静态模式
 * 读 /data/topics/:topic.json），v1 不含自有采集器。
 */
export const webDomain = createWebDomain("ux-design")
  .addRoute("app", (parent: AnyRoute) => {
    const layout = createRoute({
      getParentRoute: () => parent,
      id: "ux-design",
      component: UxDesignLayout,
    });

    const routes = [
      createRoute({
        getParentRoute: () => layout,
        path: "/ux",
        component: UxDesignPage,
        validateSearch: (search: Record<string, unknown>) => ({
          tag: typeof search.tag === "string" && search.tag ? search.tag : undefined,
        }),
      }),
      // B20：Anti-AI 菜单入口 —— 同一页面，预置 AI Slop 类目筛选
      createRoute({
        getParentRoute: () => layout,
        path: "/anti-ai",
        component: () => <UxDesignPage presetTag="anti-slop" />,
        validateSearch: (search: Record<string, unknown>) => ({
          tag: typeof search.tag === "string" && search.tag ? search.tag : undefined,
        }),
      }),
    ];

    return layout.addChildren(routes as never) as unknown as AnyRoute;
  })
  .addCapability("navItems", [
    {
      label: "UI/UX Design",
      path: "/ux",
      icon: "Palette",
      order: 41,
      group: "主题",
    },
    {
      label: "Anti-AI",
      path: "/anti-ai",
      icon: "BotOff",
      order: 42,
      group: "主题",
    },
  ]);
