import Link from "next/link"
import { Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { categoryById } from "@/lib/categories"
import type { PluginWithCategory } from "@/server/plugins/queries"

function formatStars(stars: number) {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return String(stars)
}

export function PluginListItem({ plugin }: { plugin: PluginWithCategory }) {
  const category = plugin.bundleCategory ? categoryById(plugin.bundleCategory) : undefined

  return (
    <Link
      href={`/plugins/${plugin.slug}`}
      className="group flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:border-foreground/20"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate font-mono text-sm font-semibold">{plugin.name}</h3>
        </div>
        {plugin.tagline ? (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{plugin.tagline}</p>
        ) : null}
      </div>
      {category ? (
        <Badge variant="secondary" className="hidden shrink-0 font-normal sm:inline-flex">
          <span aria-hidden>{category.emoji}</span>
          {category.label}
        </Badge>
      ) : null}
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Star className="size-3.5" />
        {formatStars(plugin.stars)}
      </span>
    </Link>
  )
}
