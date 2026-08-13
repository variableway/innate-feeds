import * as React from "react";
import { cn } from "@/lib/utils";

interface MasterDetailLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  list: React.ReactNode;
  detail: React.ReactNode;
  /** Left pane width class; default ~38%. */
  listWidthClassName?: string;
}

/**
 * Shared master-detail shell for Digest Mode B and repo detail.
 */
const MasterDetailLayout = React.forwardRef<
  HTMLDivElement,
  MasterDetailLayoutProps
>(
  (
    {
      list,
      detail,
      listWidthClassName = "w-full md:w-[38%] md:min-w-[280px] md:max-w-[420px]",
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn("flex h-full min-h-0 flex-col md:flex-row", className)}
        {...props}
      >
        <div
          className={cn(
            "flex min-h-0 flex-col border-b md:border-b-0 md:border-r",
            listWidthClassName,
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {detail}
        </div>
      </div>
    );
  },
);
MasterDetailLayout.displayName = "MasterDetailLayout";

export { MasterDetailLayout };
