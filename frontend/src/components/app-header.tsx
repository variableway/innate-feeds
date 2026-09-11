import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import { Github, ChevronRight, User, Palette, Moon, Sun } from "lucide-react";
import { THEME_VARIANTS } from "@innate/shared/theme-catalog";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import type { ThemeVariant } from "@innate/shared/theme-catalog";

interface AppHeaderProps extends React.HTMLAttributes<HTMLElement> {}

const pageTitles: Record<string, { title: string; parent?: string }> = {
  "/trending": { title: "Trending", parent: "GitHub" },
  "/starred": { title: "Starred", parent: "GitHub" },
  "/digest": { title: "Digest", parent: "Community" },
  "/settings": { title: "Settings" },
  "/dsh": { title: "Plugins" },
  "/dsh/categories": { title: "Categories", parent: "Plugins" },
};

function resolvePage(path: string): { title: string; parent?: string } {
  if (pageTitles[path]) return pageTitles[path];
  if (path.startsWith("/trending/")) {
    return { title: "Repository", parent: "Trending" };
  }
  if (path.startsWith("/starred/")) {
    return { title: "Repository", parent: "Starred" };
  }
  if (path.startsWith("/digest/")) {
    return { title: "Issue", parent: "Digest" };
  }
  if (path.startsWith("/dsh/plugins/")) {
    return { title: "Plugin", parent: "Plugins" };
  }
  if (path.startsWith("/dsh/categories/")) {
    return { title: "Category", parent: "Plugins" };
  }
  if (path.startsWith("/dsh")) {
    return { title: "Plugins" };
  }
  return { title: "Feeds" };
}

const AppHeader = React.forwardRef<HTMLElement, AppHeaderProps>(
  ({ className, ...props }, ref) => {
    const router = useRouterState();
    const currentPath = router.location.pathname;
    const page = resolvePage(currentPath);
    const { variant, setVariant, resolvedColorMode, toggleColorMode } =
      useTheme();

    return (
      <header
        ref={ref}
        className={cn(
          "flex h-14 items-center justify-between border-b bg-card/80 px-6 backdrop-blur-sm",
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2 text-sm">
          <Github className="h-4 w-4 text-muted-foreground" />
          {page.parent && (
            <>
              <span className="text-muted-foreground">{page.parent}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </>
          )}
          <span className="font-medium text-foreground">{page.title}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value as ThemeVariant)}
              className="rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Theme variant"
            >
              {THEME_VARIANTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleColorMode}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Toggle color mode"
            >
              {resolvedColorMode === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
              <User className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline">Guest</span>
          </div>
        </div>
      </header>
    );
  },
);
AppHeader.displayName = "AppHeader";

export { AppHeader };
