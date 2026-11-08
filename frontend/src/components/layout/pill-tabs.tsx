import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PillTabsOption<T extends string> {
  value: T;
  label: ReactNode;
  /** 可选计数徽标 */
  count?: number;
}

/**
 * AIHot 风格药丸筛选芯片（sprint-3 B2）：受控组件，
 * 激活态 ink 底、其余描边灰。
 */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: PillTabsOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] leading-5 transition-colors",
              active
                ? "border-transparent bg-ink text-background"
                : "border-border text-ink-3 hover:border-ink-4/40 hover:text-ink",
            )}
          >
            {opt.label}
            {opt.count != null ? (
              <span
                className={cn(
                  "tabular-nums",
                  active ? "opacity-70" : "text-ink-4",
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
