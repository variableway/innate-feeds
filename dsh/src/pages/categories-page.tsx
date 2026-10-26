import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchPluginCategories } from "@/services/plugins";
import type { PluginCategoryStat } from "@/types/plugin";

export function DshCategoriesPage() {
  const [categories, setCategories] = useState<PluginCategoryStat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPluginCategories()
      .then(setCategories)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
      <p className="mt-2 text-muted-foreground">
        Browse DSH plugins by category.
      </p>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            to="/dsh/categories/$slug"
            params={{ slug: category.id }}
            className="group block"
          >
            <article className="flex h-full items-center gap-3 rounded-lg border bg-card px-4 py-4 transition-colors group-hover:border-foreground/20">
              <span className="text-2xl" aria-hidden>
                {category.emoji}
              </span>
              <div>
                <p className="font-medium">{category.label}</p>
                <p className="text-sm text-muted-foreground">
                  {category.count} {category.count === 1 ? "plugin" : "plugins"}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
