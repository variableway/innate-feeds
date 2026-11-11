import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Hash, Loader2, Plus, Search, X } from "lucide-react";
import { useTopicsIndex } from "@/hooks/use-topics";
import {
  QUERY_GROUP_BY_ID,
  TOPIC_QUERY_CATEGORIES,
  type TopicQueryGroup,
} from "@/types/topics";
import type { TopicSummary } from "@/types/topics";
import { formatDate } from "@/lib/utils";

/**
 * GitHub Topics datasource (GH #24) — index of the synced topics.
 *
 * issue #68：按「分类 → 步骤/子类」两级组织查询（EDU 3 组 + 产品开发 5 步，
 * shared/topic-query-groups 单一真相），`?group=` / `?step=` 深链聚焦一组；
 * 不在分组内的 topic（AI 等）平铺在「其他 Topics」。每个 topic 保留 top 50
 * repos 快照；已在 trending/starred 里的 repo 标 “In feeds” 不算新发现。
 */
export function TopicsPage() {
  const {
    topics,
    total,
    updatedAt,
    loading,
    error,
    search,
    setSearch,
    saving,
    savingError,
    addTopic,
  } = useTopicsIndex();

  const searchParams = useSearch({ strict: false }) as {
    group?: string;
    step?: string;
  };
  const activeGroupId = searchParams.step ?? searchParams.group;
  const navigate = useNavigate();

  const pendingTopic = topics.find((topic) => !topic.fetchedAt);
  const byTopic = new Map(topics.map((t) => [t.topic, t]));

  const groupedTopicNames = new Set(
    TOPIC_QUERY_CATEGORIES.flatMap((cat) =>
      cat.groups.flatMap((g) => g.topics),
    ),
  );
  const ungrouped = topics.filter((t) => !groupedTopicNames.has(t.topic));
  const showUngrouped = !activeGroupId && ungrouped.length > 0;

  const visibleCategories = TOPIC_QUERY_CATEGORIES.map((cat) => ({
    ...cat,
    groups: cat.groups.filter((g) => {
      if (activeGroupId && g.id !== activeGroupId) return false;
      if (search.trim() && !g.topics.some((t) => byTopic.has(t))) return false;
      return true;
    }),
  })).filter((cat) => cat.groups.length > 0);

  const clearFocus = () => void navigate({ to: "/topics" });

  return (
    <div className="w-full space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">GitHub Topics</h1>
        <p className="text-sm text-muted-foreground">
          按分类和步骤分组查询 · Top 50 repos per topic. Repos already in the
          trending/starred feeds are marked &ldquo;In feeds&rdquo; instead of
          being counted as new.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter topics…"
            aria-label="Filter topics"
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {updatedAt && (
          <span className="text-xs text-muted-foreground">
            synced {formatDate(updatedAt)}
          </span>
        )}
        {activeGroupId && (
          <button
            type="button"
            onClick={clearFocus}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary"
          >
            {QUERY_GROUP_BY_ID[activeGroupId]?.labelZh ?? activeGroupId}
            <X className="h-3 w-3" />
          </button>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem(
              "topic",
            ) as HTMLInputElement | null;
            const value = input?.value.trim();
            if (!value) return;
            void addTopic(value).then((added) => {
              if (added && input) input.value = "";
            });
          }}
        >
          <input
            name="topic"
            placeholder="Add topic…"
            aria-label="Add topic"
            className="w-36 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </form>
      </div>

      {savingError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {savingError}
        </div>
      )}
      {pendingTopic && (
        <div className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            #{pendingTopic.topic}
          </span>{" "}
          is saved and will be collected on the next topic sync.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : (
        <>
          {search && (
            <p className="text-xs text-muted-foreground">
              {topics.length} of {total} topics
            </p>
          )}
          {visibleCategories.length === 0 && !showUngrouped && (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              {search
                ? `No topic matches "${search}".`
                : "No topics synced yet. Run `bun run sync:topics` to collect them."}
            </div>
          )}
          {visibleCategories.map((cat) => (
            <section key={cat.id} className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {cat.labelZh} · {cat.label}
              </h2>
              {cat.id === "dev" && !activeGroupId && (
                <p className="text-xs text-muted-foreground">
                  ① brainstorm → ② 需求分析和编写 → ③ 需求任务分解和开发任务编写
                  → ④ 实现计划·Spec·验证测试·handoff → ⑤ UI/UX
                  设计·分析·优化·Anti-Slop
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cat.groups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    byTopic={byTopic}
                    focused={activeGroupId === group.id}
                    onFocus={() =>
                      void navigate({
                        to: "/topics",
                        search: { group: group.id },
                      })
                    }
                  />
                ))}
              </div>
            </section>
          ))}

          {showUngrouped && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                其他 Topics
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ungrouped.map((topic) => (
                  <TopicCard key={topic.topic} topic={topic} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function GroupCard({
  group,
  byTopic,
  focused,
  onFocus,
}: {
  group: TopicQueryGroup;
  byTopic: Map<string, TopicSummary>;
  focused: boolean;
  onFocus: () => void;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border bg-card p-4 ${
        focused ? "border-primary/60" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {group.kind === "step" && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {group.step}
          </span>
        )}
        <button
          type="button"
          onClick={onFocus}
          className="text-left text-sm font-semibold text-foreground hover:underline"
          title="点击聚焦该组"
        >
          {group.labelZh}
        </button>
        <span className="text-xs text-muted-foreground">{group.label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.topics.map((name) => {
          const summary = byTopic.get(name);
          return (
            <Link
              key={name}
              to="/topics/$topic"
              params={{ topic: name }}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/40"
            >
              <Hash className="h-3 w-3" />
              <span className="font-medium text-foreground">{name}</span>
              {summary?.fetchedAt ? (
                <>
                  <span className="text-primary">{summary.newCount} new</span>
                  <span>{summary.count}</span>
                </>
              ) : (
                <span>pending</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: TopicSummary }) {
  return (
    <Link
      to="/topics/$topic"
      params={{ topic: topic.topic }}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-foreground group-hover:underline">
          {topic.topic}
        </span>
      </div>
      {topic.fetchedAt ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
            {topic.newCount} new
          </span>
          <span>{topic.count} repos</span>
          {topic.existingCount > 0 && (
            <span>{topic.existingCount} in feeds</span>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Pending sync</div>
      )}
      {topic.fetchedAt && (
        <span className="text-[11px] text-muted-foreground">
          updated {formatDate(topic.fetchedAt)}
        </span>
      )}
    </Link>
  );
}
