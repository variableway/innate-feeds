/**
 * 独立宿主入口：domain 脱离 webshell 单独运行时的最小壳。
 * 只提供紧凑左栏导航（host-shell）；sidebar 细节/主题由 innate-fe webshell 在插件态承担。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createStandaloneWebDomainRouter } from "@innate/web-domain";
import { webDomain } from "./web-domain";
import { HostShell } from "./host-shell";

const basepath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const router = createStandaloneWebDomainRouter(webDomain, {
  history: "browser",
  ...(basepath ? { basepath } : {}),
});

function App() {
  return (
    <HostShell
      domain={webDomain}
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
