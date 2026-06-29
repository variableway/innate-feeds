import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { CategoryPanel } from "@/components/category-panel";
import { fetchStats } from "@/services/feeds";
import type { FeedStats } from "@/types/feed";

function RootLayout() {
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-root flex h-screen bg-background">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <CategoryPanel stats={stats} loading={loading} />
      <div className="app-content flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
