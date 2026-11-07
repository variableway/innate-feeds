import { EDU_CATEGORIES } from "../../../../shared/edu-categories";
import type { EduRelevance } from "../types/edu";

export interface EduFilterState {
  q: string;
  category: string;
  relevance: EduRelevance | "";
  sort: string;
  page: number;
}

interface EduFilterBarProps {
  state: EduFilterState;
  onChange: (next: Partial<EduFilterState>) => void;
  /** 排序选项；skills 与 videos 各不相同。 */
  sortOptions: { value: string; label: string }[];
  /** 是否显示相关度筛选（仅 skills 有 core/related 之分）。 */
  showRelevance?: boolean;
  searchPlaceholder: string;
}

/** 列表页的筛选栏：关键词 / 分类 / 排序（+ 相关度）。 */
export function EduFilterBar({
  state,
  onChange,
  sortOptions,
  showRelevance,
  searchPlaceholder,
}: EduFilterBarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={state.q}
          onChange={(event) => onChange({ q: event.target.value, page: 1 })}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
        />
        {showRelevance ? (
          <select
            value={state.relevance}
            onChange={(event) =>
              onChange({
                relevance:
                  event.target.value === ""
                    ? ""
                    : (event.target.value as EduRelevance),
                page: 1,
              })
            }
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="Relevance"
          >
            <option value="">全部相关度</option>
            <option value="core">Core（教育动画主链路）</option>
            <option value="related">Related（泛动效周边）</option>
          </select>
        ) : null}
        <select
          value={state.sort}
          onChange={(event) => onChange({ sort: event.target.value, page: 1 })}
          className="h-9 rounded-md border bg-background px-2 text-sm text-ink-3"
          aria-label="Sort"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* AIHot 风格分类药丸（sprint-3 B6）：域内自绘，不引 host 组件 */}
      <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2" role="tablist" aria-label="Category">
        {[{ id: "", emoji: "🗂", labelZh: "全部分类" }, ...EDU_CATEGORIES].map((category) => {
          const active = state.category === category.id;
          return (
            <button
              key={category.id || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange({ category: category.id, page: 1 })}
              className={
                active
                  ? "rounded-full border border-transparent bg-ink px-3 py-1 text-[13px] leading-5 text-background"
                  : "rounded-full border border-border px-3 py-1 text-[13px] leading-5 text-ink-3 transition-colors hover:border-ink-4/40 hover:text-ink"
              }
            >
              {category.emoji} {category.labelZh}
            </button>
          );
        })}
      </div>
    </div>
  );
}
