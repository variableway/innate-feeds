import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** AIHot EmptyState（Page.tsx:100）：标题 + 说明 + 可选操作。 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-4">
          {children}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
