import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchEduCategoryCounts } from "../services/edu";
import type { EduCategoryCount } from "../types/edu";

/** `/edu/categories` —— 分类总览（skills + videos 合并计数）。 */
export function EduCategoriesPage() {
  const [categories, setCategories] = useState<EduCategoryCount[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchEduCategoryCounts()
      .then(setCategories)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">分类总览</h1>
      <p className="mt-2 text-muted-foreground">
        按教育动画的制作环节分类 —— SKILL 与视频合并计数。
      </p>
      <nav className="mt-4 flex gap-4 text-sm">
        <Link to="/edu" className="text-primary hover:underline">
          SKILL 目录
        </Link>
        <Link to="/edu/videos" className="text-primary hover:underline">
          教学视频
        </Link>
      </nav>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            to="/edu"
            search={{ category: category.id }}
            className="group block"
          >
            <article className="flex h-full items-center gap-3 rounded-lg border bg-card px-4 py-4 transition-colors group-hover:border-foreground/20">
              <span className="text-2xl" aria-hidden>
                {category.emoji}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{category.labelZh}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {category.label} · {category.count} 条
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
