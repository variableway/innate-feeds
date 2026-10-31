import { createRoute, Navigate } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { createWebDomain } from "@innate/web-domain";
import { DomainLayout } from "./domain-layout";
import { TrendingPage } from "@/pages/trending/page";
import { TrendingShiftPage } from "@/pages/trending-shift/page";
import { TopicsPage } from "@/pages/topics/page";
import { TopicPage } from "@/pages/topics/topic-page";
import { StarredPage } from "@/pages/starred/page";
import { DigestPage } from "@/pages/digest/page";
import { FeedsPage } from "@/pages/feeds/page";
import { FeedsSourcePage } from "@/pages/feeds/source-page";
import { SettingsPage } from "@/pages/settings/page";
import { AdminPage } from "@/pages/admin/page";
import { EXTERNAL_SOURCE_META } from "@/types/external";

/**
 * innate-feeds 的 domain 声明（轨道 A）。
 * 硬条件：包名 `@innate/domain-feeds` + 本模块 `export { webDomain }`。
 * 壳侧栏 / 首页 tile 走 capability，不携带本仓基础 UI。
 * /dsh 插件目录已拆为独立域 @innate/domain-dsh（issue #13，顶层 dsh/）。
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
        path: "/trending-shift",
        component: TrendingShiftPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/topics",
        component: TopicsPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/topics/$topic",
        component: TopicPage,
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
        path: "/feeds",
        component: FeedsPage,
      }),
      createRoute({
        getParentRoute: () => layout,
        path: "/feeds/$source",
        component: FeedsSourcePage,
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
      label: "Trending Shift",
      path: "/trending-shift",
      icon: "TrendingUp",
      order: 12,
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
      label: "Topics",
      path: "/topics",
      icon: "Hash",
      order: 13,
      group: "GitHub",
    },
    {
      label: "Digest",
      path: "/digest",
      icon: "Newspaper",
      order: 20,
      group: "GitHub",
    },
    // GH #31: Feeds 组 — 外部数据源（总览 + 各源子菜单），顺序取 meta 定义。
    {
      label: "Feeds",
      path: "/feeds",
      icon: "Rss",
      order: 21,
      group: "Feeds",
    },
    ...EXTERNAL_SOURCE_META.map((meta, idx) => ({
      label: meta.title,
      path: `/feeds/${meta.source}`,
      icon: meta.icon,
      order: 22 + idx,
      group: "Feeds",
    })),
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
