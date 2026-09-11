import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { categoryById } from "@/lib/categories"
import type { PluginWithCategory } from "@/server/plugins/queries"

function formatStars(stars: number) {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return String(stars)
}

export function PluginCard({ plugin }: { plugin: PluginWithCategory }) {
  const category = plugin.bundleCategory ? categoryById(plugin.bundleCategory) : undefined

  return (
    <Link href={`/plugins/${plugin.slug}`} className="group block h-full">
      <Card className="h-full gap-3 overflow-hidden py-0 transition-colors group-hover:border-foreground/20">
        {plugin.screenshotUrl ? (
          <div className="relative aspect-[2/1] w-full overflow-hidden border-b bg-muted">
            <Image
              src={plugin.screenshotUrl}
              alt={`${plugin.name} screenshot`}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover object-top"
            />
          </div>
        ) : null}
        <CardContent className={`flex flex-col gap-2 px-4 pb-4 ${plugin.screenshotUrl ? "pt-0" : "pt-4"}`}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-mono text-sm font-semibold leading-tight break-all">
              {plugin.name}
            </h3>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Star className="size-3.5" />
              {formatStars(plugin.stars)}
            </span>
          </div>
          {plugin.tagline ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{plugin.tagline}</p>
          ) : null}
          {category ? (
            <div>
              <Badge variant="secondary" className="font-normal">
                <span aria-hidden>{category.emoji}</span>
                {category.label}
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  )
}
