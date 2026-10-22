import { Outlet } from "@tanstack/react-router";
import { DigestFiltersProvider } from "@/hooks/use-digest-list";

/**
 * Domain 内部布局：只包业务上下文（Digest 筛选）与滚动容器。
 * 壳（sidebar / header / 主题）由宿主提供，不在此层。
 */
export function DomainLayout() {
  return (
    <DigestFiltersProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <main className="flex min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </DigestFiltersProvider>
  );
}
