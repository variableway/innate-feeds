import type { FeedItem } from "@/types/feed";
import { cn } from "@/lib/utils";

/**
 * AIHot 热点榜三层结构（sprint-3 B4）：
 * NO.1 大卡（走势位占位）→ NO.2/3 中卡两列 → NO.4-10 行榜（rank-* 色阶）。
 * 「热度怎么算」折叠：v1 按 stars 排序，ruleVersion 公式等 M1。
 */

function starsText(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function RankBadge({ rank }: { rank: number }) {
  const color =
    rank === 1 ? "text-rank-1" : rank === 2 ? "text-rank-2" : rank === 3 ? "text-rank-3" : "text-rank-rest";
  return (
    <span className={cn("text-[13px] font-semibold tabular-nums", color)}>NO.{rank}</span>
  );
}

function MetaRow({ item }: { item: FeedItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-4">
      <span className="text-ink-3">★ {starsText(item.repo.stars)}</span>
      <span>⑂ {starsText(item.repo.forks)}</span>
      {item.repo.language ? (
        <span className="rounded-mark border border-border px-1.5 py-0.5 text-[12px] text-ink-3">
          {item.repo.language}
        </span>
      ) : null}
    </div>
  );
}

export function HotBoard({
  items,
  selectedRepoId,
  onSelectItem,
}: {
  items: FeedItem[];
  selectedRepoId?: string | null;
  onSelectItem?: (item: FeedItem) => void;
}) {
  if (items.length === 0) return null;
  const [first, second, third, ...rest] = items;
  const isSelected = (item: FeedItem) =>
    selectedRepoId != null &&
    (item.id === selectedRepoId || String(item.repo.id) === selectedRepoId);

  return (
    <section aria-label="热点榜" className="mb-6 space-y-3">
      {/* NO.1 大卡 */}
      <button
        type="button"
        onClick={() => onSelectItem?.(first)}
        className={cn(
          "block w-full rounded-card border bg-card p-5 text-left transition-colors hover:border-ink-4/40",
          isSelected(first) && "border-ink",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RankBadge rank={1} />
              <span className="truncate text-lg font-semibold text-ink">{first.repo.fullName}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-3">
              {first.repo.description || "（无描述）"}
            </p>
            <div className="mt-3">
              <MetaRow item={first} />
            </div>
          </div>
        </div>
        {/* 走势位：结构就绪，数据等 M1 hot_snapshots */}
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-hot-soft" aria-hidden />
          <span className="text-[11px] text-ink-4">走势 · 等 M1 热度数据</span>
        </div>
      </button>

      {/* NO.2 / NO.3 中卡 */}
      {[second, third].map((item, i) =>
        item ? (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectItem?.(item)}
            className={cn(
              "block w-full rounded-card border bg-card p-4 text-left transition-colors hover:border-ink-4/40",
              isSelected(item) && "border-ink",
            )}
          >
            <div className="flex items-center gap-2">
              <RankBadge rank={i + 2} />
              <span className="truncate text-[15px] font-medium text-ink">{item.repo.fullName}</span>
            </div>
            <p className="mt-1 line-clamp-1 text-[13px] text-ink-3">{item.repo.description || "（无描述）"}</p>
            <div className="mt-2">
              <MetaRow item={item} />
            </div>
          </button>
        ) : null,
      )}

      {/* NO.4-10 行榜 */}
      {rest.length > 0 ? (
        <div className="overflow-hidden rounded-card border bg-card">
          {rest.slice(0, 7).map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectItem?.(item)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border/50 px-4 py-2.5 text-left last:border-b-0 hover:bg-accent/40",
                isSelected(item) && "bg-accent",
              )}
            >
              <span className="w-8 shrink-0 text-[13px] font-medium tabular-nums text-rank-rest">
                {i + 4}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink-2">{item.repo.fullName}</span>
              <span className="hidden shrink-0 text-[13px] text-ink-4 sm:block">
                {item.repo.language ?? ""}
              </span>
              <span className="shrink-0 text-[13px] tabular-nums text-ink-3">
                ★ {starsText(item.repo.stars)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {/* 热度怎么算（ruleVersion 透明化，公式等 M1） */}
      <details className="rounded-card border bg-card px-4 py-2 text-[13px] text-ink-4">
        <summary className="cursor-pointer select-none text-ink-3">热度怎么算</summary>
        <p className="mt-2 leading-relaxed">
          当前（v1）：按 star 数排序的快照榜，无跨源加权。规划中：M1 热度引擎将引入
          ruleVersion 化公式（跨源信号 + 独立源去重 + 半衰），届时此处展示可解释的计算口径。
        </p>
      </details>
    </section>
  );
}
