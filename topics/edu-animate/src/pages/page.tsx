import { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  EduFilterBar,
  type EduFilterState,
} from "../components/edu-filter-bar";
import { EduPagination } from "../components/edu-pagination";
import { SkillCard } from "../components/skill-card";
import {
  fetchEduOverview,
  fetchEduSkills,
  type EduOverview,
} from "../services/edu";
import type { EduSearch, EduSkill } from "../types/edu";

const SORT_OPTIONS = [
  { value: "installs.desc", label: "安装量 ↓" },
  { value: "stars.desc", label: "Stars ↓" },
  { value: "updated.desc", label: "最近更新 ↓" },
  { value: "name.asc", label: "名称 A–Z" },
];

/** `/edu` —— 领域 SKILL 列表（本域首页）。 */
export function EduSkillsPage() {
  const search = useSearch({ strict: false }) as EduSearch;
  const navigate = useNavigate();
  const [skills, setSkills] = useState<EduSkill[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [overview, setOverview] = useState<EduOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchEduOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchEduSkills({
      q: search.q,
      category: search.category,
      relevance:
        search.relevance === "core" || search.relevance === "related"
          ? search.relevance
          : undefined,
      sort: search.sort ?? "installs.desc",
      page: search.page ?? 1,
    })
      .then((result) => {
        if (cancelled) return;
        setSkills(result.items);
        setTotal(result.total);
        setPageCount(result.pageCount);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [search.q, search.category, search.relevance, search.sort, search.page]);

  const state: EduFilterState = {
    q: search.q ?? "",
    category: search.category ?? "",
    relevance:
      search.relevance === "core" || search.relevance === "related"
        ? search.relevance
        : "",
    sort: search.sort ?? "installs.desc",
    page: search.page ?? 1,
  };

  const onChange = (next: Partial<EduFilterState>) => {
    void navigate({
      search: ((prev: EduSearch) => ({
        ...prev,
        ...next,
      })) as unknown as true,
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          教育动画制作
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          面向教育动画的 Agent Skill 目录与教学视频参考
        </p>
        {overview ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {overview.skills} 个 SKILL（其中 {overview.coreSkills} 个强相关） ·{" "}
            {overview.videos} 个教学视频 · {overview.channels} 个频道
          </p>
        ) : null}
      </section>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <EduFilterBar
        state={state}
        onChange={onChange}
        sortOptions={SORT_OPTIONS}
        showRelevance
        searchPlaceholder="搜索 SKILL、仓库或描述"
      />

      <p className="mb-4 text-[13px] tabular-nums text-ink-4">{total} 个 SKILL</p>

      {skills.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">没有匹配的 SKILL。</p>
          <button
            type="button"
            onClick={() =>
              onChange({
                q: "",
                category: "",
                relevance: "",
                sort: "installs.desc",
                page: 1,
              })
            }
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            清除筛选
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}

      <EduPagination
        page={state.page}
        pageCount={pageCount}
        onChange={(page) => onChange({ page })}
      />
    </div>
  );
}
