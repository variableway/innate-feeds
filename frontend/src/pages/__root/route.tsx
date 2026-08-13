import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { DigestFiltersProvider } from "@/hooks/use-digest-list";

function RootLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <DigestFiltersProvider>
      <div className="app-root flex h-screen bg-background">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
        <div className="app-content flex flex-1 flex-col overflow-hidden">
          <AppHeader />
          <main className="flex min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </DigestFiltersProvider>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
