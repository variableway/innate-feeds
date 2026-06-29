import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import { Github, ChevronRight, User, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

interface AppHeaderProps extends React.HTMLAttributes<HTMLElement> {}

const pageTitles: Record<string, { title: string; parent?: string }> = {
  "/trending": { title: "Trending", parent: "GitHub" },
  "/starred": { title: "Starred", parent: "GitHub" },
};

const AppHeader = React.forwardRef<HTMLElement, AppHeaderProps>(
  ({ className, ...props }, ref) => {
    const router = useRouterState();
    const currentPath = router.location.pathname;
    const page = pageTitles[currentPath] || { title: "Feeds" };
    const { theme, setTheme } = useTheme();

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
              value={theme}
              onChange={(e) =>
                setTheme(e.target.value as "default" | "notion" | "linear")
              }
              className="rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="default">Default</option>
              <option value="notion">Notion</option>
              <option value="linear">Linear</option>
            </select>
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
