/**
 * 独立宿主壳（host-only）：webshell 缺席时提供最小导航。
 * 导航项聚合自全部 domain 的 `navItems` capability（collectNavItems）——
 * 与 innate-fe 插件态同一事实源（issue #13 后为 feeds + dsh 双域）。
 * 两个可折叠分组菜单（GitHub / DeepSeek Harness），子项按 `group` 归类。
 * 不属于 domain：插件态下 webshell 自己画侧栏，本文件不被打包进 domains/。
 */
import { useEffect, useMemo, useState } from "react";
import {
  Github,
  Star,
  Newspaper,
  Puzzle,
  Settings,
  TrendingUp,
  Hash,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { collectNavItems, type WebDomain } from "@innate/web-domain";

const ICONS: Record<string, LucideIcon> = {
  Github,
  Star,
  Newspaper,
  Puzzle,
  Settings,
  TrendingUp,
  Hash,
};

/** 分组图标（与 navItems 的 group 名对应）。 */
const GROUP_ICONS: Record<string, LucideIcon> = {
  GitHub: Github,
  "DeepSeek Harness": Puzzle,
};

interface NavItem {
  label: string;
  path: string;
  icon?: string;
  order?: number;
  group?: string;
}

interface NavGroup {
  name: string;
  icon: LucideIcon | null;
  items: NavItem[];
  order: number;
}

function navItemsOf(domains: WebDomain[]): NavItem[] {
  return collectNavItems(domains) as NavItem[];
}

/** 按 `group` 归类；组序取组内最小 order，无 group 的项归入默认组。 */
function groupNavItems(items: NavItem[]): NavGroup[] {
  const sorted = [...items].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  const map = new Map<string, NavGroup>();
  for (const item of sorted) {
    const name = item.group ?? "";
    let group = map.get(name);
    if (!group) {
      group = {
        name,
        icon: GROUP_ICONS[name] ?? null,
        items: [],
        order: item.order ?? 100,
      };
      map.set(name, group);
    }
    group.items.push(item);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}

interface HostRouter {
  state: { location: { pathname: string } };
  navigate: (opts: { to: string }) => void;
  subscribe: (fn: () => void) => unknown;
}

function isItemActive(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
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

  const groups = useMemo(() => groupNavItems(navItemsOf(domains)), [domains]);

  // 含当前路由的分组默认展开；其余保持收起状态
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isGroupCollapsed = (name: string): boolean => {
    if (name in collapsed) return collapsed[name]!;
    return !groups.some(
      (g) =>
        g.name === name &&
        g.items.some((item) => isItemActive(pathname, item.path)),
    );
  };
  const toggleGroup = (name: string) => {
    setCollapsed((prev) => ({ ...prev, [name]: !isGroupCollapsed(name) }));
  };

  return (
    <div className="flex h-screen bg-background">
      {/* 紧凑左栏：独立态自有导航（插件态由 webshell 提供，此处不参与） */}
      <nav className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r bg-card py-2">
        <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Feeds
        </div>
        {groups.map((group) => {
          const open = !isGroupCollapsed(group.name);
          const GroupIcon = group.icon;
          const hasActive = group.items.some((item) =>
            isItemActive(pathname, item.path),
          );
          return (
            <div key={group.name} className="px-1.5">
              <button
                type="button"
                onClick={() => toggleGroup(group.name)}
                aria-expanded={open}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors",
                  hasActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {GroupIcon ? <GroupIcon className="h-4 w-4" /> : null}
                <span className="flex-1 text-left">{group.name}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    open ? "" : "-rotate-90",
                  )}
                />
              </button>
              {open ? (
                <div className="ml-3 flex flex-col gap-0.5 border-l pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon ? (ICONS[item.icon] ?? null) : null;
                    const active = isItemActive(pathname, item.path);
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => void router.navigate({ to: item.path })}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                        )}
                      >
                        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
