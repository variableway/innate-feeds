/**
 * 独立宿主入口：后台管理项目（issue #70）脱离 webshell 单独运行时的最小壳。
 * 组合 admin 域（采集任务 + SQLite 工作台）：
 * 路由经 collectWebDomainRoutes 挂到根路由，导航经 HostShell 聚合 navItems。
 * 只提供紧凑左栏导航（host-shell）；本文件属宿主（host-only）。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import {
  createRootRoute,
  createRouter,
  createBrowserHistory,
  RouterProvider,
  type AnyRoute,
} from "@tanstack/react-router";
import { collectWebDomainRoutes } from "@innate/web-domain";
import { Toaster } from "@innate/ui";
import { webDomain as adminDomain } from "./web-domain";
import { HostShell } from "./host-shell";

const domains = [adminDomain];

const basepath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const rootRoute = createRootRoute({
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-ink-2 text-sm font-medium">404 · 页面不存在</p>
      <p className="text-ink-4 mt-1.5 max-w-sm text-[13px] leading-relaxed">
        <a
          href="/admin/tasks"
          className="text-primary underline-offset-2 hover:underline"
        >
          回任务面板
        </a>
      </p>
    </div>
  ),
});
const attachments = collectWebDomainRoutes(domains, {
  app: rootRoute as unknown as AnyRoute,
});
// tanstack router 的 Route 泛型变体极重，addChildren 官方示例亦按 any 数组传递
const children: any[] = attachments.map((attachment) => attachment.route);
const routeTree = rootRoute.addChildren(children) as unknown as AnyRoute;
const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
  ...(basepath ? { basepath } : {}),
});

function App() {
  return (
    <HostShell
      domains={domains}
      router={router as unknown as Parameters<typeof HostShell>[0]["router"]}
    >
      <RouterProvider router={router} />
      <Toaster />
    </HostShell>
  );
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
