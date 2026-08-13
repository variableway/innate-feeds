import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Github,
  Newspaper,
  PanelLeft,
  Settings,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean;
  onToggle?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  isActive: (path: string) => boolean;
}

const AppSidebar = React.forwardRef<HTMLDivElement, AppSidebarProps>(
  ({ collapsed = false, onToggle, className, ...props }, ref) => {
    const router = useRouterState();
    const currentPath = router.location.pathname;

    const navItems: NavItem[] = [
      {
        title: "GitHub",
        href: "/trending",
        icon: Github,
        isActive: (path) =>
          path.startsWith("/trending") || path.startsWith("/starred"),
      },
      {
        title: "Digest",
        href: "/digest",
        icon: Newspaper,
        isActive: (path) => path.startsWith("/digest"),
      },
    ];

    const bottomItems: NavItem[] = [
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        isActive: (path) => path.startsWith("/settings"),
      },
    ];

    return (
      <div
        ref={ref}
        className={cn(
          "app-sidebar flex h-screen flex-col border-r transition-all duration-200",
          collapsed ? "w-16" : "w-64",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b",
            collapsed ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          <Link
            to="/"
            className={cn(
              "flex items-center gap-3",
              collapsed && "justify-center",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Github className="h-5 w-5" />
            </div>
            {!collapsed && <span className="font-semibold">Innate Feeds</span>}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.isActive(currentPath);
              return (
                <Link
                  key={item.title}
                  to={item.href}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && item.title}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t p-3">
          <div className="space-y-1">
            {bottomItems.map((item) => {
              const isActive = item.isActive(currentPath);
              return (
                <Link
                  key={item.title}
                  to={item.href}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && item.title}
                </Link>
              );
            })}
            <a
              href="#"
              title={collapsed ? "Help" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <HelpCircle className="h-4 w-4 shrink-0" />
              {!collapsed && "Help"}
            </a>
          </div>

          <button
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "mt-3 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <PanelLeft className="h-4 w-4 shrink-0" />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </div>
    );
  },
);
AppSidebar.displayName = "AppSidebar";

export { AppSidebar };
