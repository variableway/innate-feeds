import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface GitHubProductTabsProps extends React.HTMLAttributes<HTMLDivElement> {}

const TABS = [
  { label: "Trending", href: "/trending" as const },
  { label: "Starred", href: "/starred" as const },
] as const;

const GitHubProductTabs = React.forwardRef<
  HTMLDivElement,
  GitHubProductTabsProps
>(({ className, ...props }, ref) => {
  const router = useRouterState();
  const currentPath = router.location.pathname;

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="GitHub feeds"
      className={cn("flex items-center gap-1 border-b", className)}
      {...props}
    >
      {TABS.map((tab) => {
        const isActive = currentPath.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            to={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
});
GitHubProductTabs.displayName = "GitHubProductTabs";

export { GitHubProductTabs };
