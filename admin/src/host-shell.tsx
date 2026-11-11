/**
 * 独立宿主壳（host-only）：后台管理项目的最小左栏导航。
 * 导航项聚合自 domain 的 `navItems` capability（collectNavItems）——
 * 与 innate-fe 插件态同一事实源。不属于 domain，不进 domains/ 打包面。
 */
import { useEffect, useMemo, useState } from "react";
import {
  Database,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { collectNavItems, type WebDomain } from "@innate/web-domain";

const ICONS: Record<string, LucideIcon> = {
  Database,
  ListChecks,
};

const NAV_COLLAPSED_KEY = "innate-admin:host-nav-collapsed";

function readNavCollapsed(): boolean {
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

interface NavItem {
  label: string;
  path: string;
  icon?: string;
  order?: number;
}

interface HostRouter {
  state: { location: { pathname: string } };
  navigate: (opts: { to: string }) => void;
  subscribe: (fn: () => void) => unknown;
}

/** 最长前缀胜出的激活判定（与 innate-feeds host-shell 同一语义）。 */
function isItemActive(
  pathname: string,
  itemPath: string,
  items: NavItem[],
): boolean {
  const matches = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  if (!matches(itemPath)) return false;
  return !items.some(
    (other) =>
      other.path !== itemPath &&
      matches(other.path) &&
      other.path.length > itemPath.length,
  );
}

export function HostShell({
  domains,
  router,
  children,
}: {
  domains: WebDomain[];
  router: HostRouter;
  children: React.ReactNode;
}) {
  const [pathname, setPathname] = useState(router.state.location.pathname);

  useEffect(() => {
    const unsub = router.subscribe(() => {
      setPathname(router.state.location.pathname);
    }) as () => void;
    return unsub;
  }, [router]);

  const navItems = useMemo(
    () =>
      (collectNavItems(domains) as NavItem[]).sort(
        (a, b) => (a.order ?? 100) - (b.order ?? 100),
      ),
    [domains],
  );

  const [navCollapsed, setNavCollapsed] = useState<boolean>(readNavCollapsed);
  const toggleNav = () => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage unavailable — keep in-memory value only
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <nav
        className={
          navCollapsed
            ? "bg-sidebar flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r py-2"
            : "bg-sidebar flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r py-2"
        }
      >
        <div className="flex items-center justify-between px-3 pb-2 pt-1">
          {navCollapsed ? null : (
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Innate Admin
            </span>
          )}
          <button
            type="button"
            onClick={toggleNav}
            title={navCollapsed ? "展开侧栏" : "折叠侧栏"}
            className="text-muted-foreground hover:text-foreground inline-flex items-center"
          >
            {navCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon ? (ICONS[item.icon] ?? null) : null;
          const active = isItemActive(pathname, item.path, navItems);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => void router.navigate({ to: item.path })}
              title={item.label}
              className={cn(
                "flex items-center gap-2 rounded-md transition-colors",
                navCollapsed
                  ? "h-8 w-8 justify-center"
                  : "mx-1.5 px-2 py-1.5 text-[13px] font-medium",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
              )}
            >
              {Icon ? (
                <Icon className={navCollapsed ? "h-4 w-4" : "h-3.5 w-3.5"} />
              ) : null}
              {navCollapsed ? null : item.label}
            </button>
          );
        })}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
