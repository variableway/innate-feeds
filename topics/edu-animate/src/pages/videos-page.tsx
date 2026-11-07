import { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  EduFilterBar,
  type EduFilterState,
} from "../components/edu-filter-bar";
import { EduPagination } from "../components/edu-pagination";
import { VideoCard } from "../components/video-card";
import { fetchEduVideos } from "../services/edu";
import type { EduSearch, EduVideo } from "../types/edu";

const SORT_OPTIONS = [
  { value: "published.desc", label: "最新发布 ↓" },
  { value: "views.desc", label: "播放量 ↓" },
  { value: "duration.asc", label: "时长 ↑" },
  { value: "title.asc", label: "标题 A–Z" },
];

/** `/edu/videos` —— 教学视频列表。 */
export function EduVideosPage() {
  const search = useSearch({ strict: false }) as EduSearch;
  const navigate = useNavigate();
  const [videos, setVideos] = useState<EduVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchEduVideos({
      q: search.q,
      category: search.category,
      sort: search.sort ?? "published.desc",
      page: search.page ?? 1,
    })
      .then((result) => {
        if (cancelled) return;
        setVideos(result.items);
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
  }, [search.q, search.category, search.sort, search.page]);

  const state: EduFilterState = {
    q: search.q ?? "",
    category: search.category ?? "",
    relevance: "",
    sort: search.sort ?? "published.desc",
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
          教学视频
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          策展频道的教育动画参考片 —— 只收录元数据与链接
        </p>
        <nav className="mt-4 flex gap-4 text-sm">
          <Link to="/edu" className="text-primary hover:underline">
            SKILL 目录
          </Link>
          <Link to="/edu/categories" className="text-primary hover:underline">
            分类总览
          </Link>
        </nav>
      </section>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <EduFilterBar
        state={state}
        onChange={onChange}
        sortOptions={SORT_OPTIONS}
        searchPlaceholder="搜索视频标题或频道"
      />

      <p className="mb-4 text-sm text-muted-foreground">{total} 个视频</p>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">没有匹配的视频。</p>
          <button
            type="button"
            onClick={() =>
              onChange({
                q: "",
                category: "",
                sort: "published.desc",
                page: 1,
              })
            }
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            清除筛选
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
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
