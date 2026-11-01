import { Outlet } from "@tanstack/react-router";

/**
 * edu-animate 域内部布局：滚动容器（与 dsh / feeds 域同款结构，无业务 context）。
 * 壳（sidebar / header / 主题）由宿主提供，不在此层。
 */
export function EduLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <main className="flex min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
