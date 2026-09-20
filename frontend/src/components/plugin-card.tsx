import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { pluginCategoryById } from "@innate/shared/plugin-categories";
import type { DshPlugin } from "@/types/plugin";

function formatStars(stars: number) {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(stars);
}

export function PluginCard({ plugin }: { plugin: DshPlugin }) {
  const category = pluginCategoryById(plugin.bundleCategory);

  return (
    <Link
      to="/dsh/plugins/$slug"
      params={{ slug: plugin.slug }}
      className="group block h-full"
    >
      <article className="flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-colors group-hover:border-foreground/20">
        {plugin.screenshotUrl ? (
          <div className="aspect-[2/1] w-full overflow-hidden border-b bg-muted">
            <img
              src={plugin.screenshotUrl}
              alt={`${plugin.name} screenshot`}
              className="h-full w-full object-cover object-top"
            />
          </div>
        ) : null}
        <div
          className={`flex flex-1 flex-col gap-2 px-4 pb-4 ${plugin.screenshotUrl ? "pt-3" : "pt-4"}`}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-mono text-sm font-semibold leading-tight break-all">
              {plugin.name}
            </h3>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5" />
              {formatStars(plugin.stars)}
            </span>
          </div>
          {plugin.tagline ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {plugin.tagline}
            </p>
          ) : null}
          {category ? (
            <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              <span aria-hidden>{category.emoji}</span>
              {category.label}
            </span>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
