import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { pluginCategoryById } from "@innate/shared/plugin-categories";
import type { DshPlugin } from "@/types/plugin";

function formatStars(stars: number) {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(stars);
}

export function PluginListItem({ plugin }: { plugin: DshPlugin }) {
  const category = pluginCategoryById(plugin.bundleCategory);

  return (
    <Link
      to="/dsh/plugins/$slug"
      params={{ slug: plugin.slug }}
      className="group flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:border-foreground/20"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-mono text-sm font-semibold">
          {plugin.name}
        </h3>
        {plugin.tagline ? (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {plugin.tagline}
          </p>
        ) : null}
      </div>
      {category ? (
        <span className="hidden shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground sm:inline-flex">
          <span aria-hidden>{category.emoji}</span>
          {category.label}
        </span>
      ) : null}
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Star className="h-3.5 w-3.5" />
        {formatStars(plugin.stars)}
      </span>
    </Link>
  );
}
