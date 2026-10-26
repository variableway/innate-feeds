/**
 * 独立宿主入口：domain 脱离 webshell 单独运行时的最小壳。
 * 组合本仓全部 domain（feeds + dsh，issue #13 拆分后双域单站）：
 * 路由经 collectWebDomainRoutes 挂到根路由，导航经 HostShell 聚合 navItems。
 * 只提供紧凑左栏导航（host-shell）；sidebar 细节/主题由 innate-fe webshell
 * 在插件态承担。本文件属宿主（host-only），不进 domains/ 打包面。
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
import { webDomain as feedsDomain } from "./web-domain";
import { webDomain as dshDomain } from "../../dsh/src/index";
import { HostShell } from "./host-shell";

const domains = [feedsDomain, dshDomain];

const basepath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const rootRoute = createRootRoute();
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
