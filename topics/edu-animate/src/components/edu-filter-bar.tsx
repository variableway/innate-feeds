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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={state.q}
          onChange={(event) => onChange({ q: event.target.value, page: 1 })}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
        />
        <select
          value={state.category}
          onChange={(event) =>
            onChange({ category: event.target.value, page: 1 })
          }
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Category"
        >
          <option value="">全部分类</option>
          {EDU_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.emoji} {category.labelZh}
            </option>
          ))}
        </select>
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
      </div>
      <div className="flex items-center gap-3">
        <select
          value={state.sort}
          onChange={(event) => onChange({ sort: event.target.value, page: 1 })}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Sort"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
