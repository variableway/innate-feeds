import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * AIHot ReadingLayout（sprint-3 B2，结构取自 references/AIHOT
 * apps/web/app/components/ui/Page.tsx:12）：单栏阅读列 + 可选右侧栏。
 * 断点对应 AIHot 的 side: → lg:。
 */
export function ReadingLayout({
  children,
  aside,
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-[var(--page-max-reading)] gap-8 pb-14 pt-5 lg:pt-0",
        aside &&
          "lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 2xl:grid-cols-[minmax(0,1fr)_340px]",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      {aside ? <aside className="min-w-0">{aside}</aside> : null}
    </div>
  );
}
