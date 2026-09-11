import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PluginListing } from "@/components/plugin-listing"
import { CATEGORIES, categoryById } from "@/lib/categories"
import { searchPlugins } from "@/server/plugins/queries"
import { loadSearchParams } from "@/server/plugins/search-params"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = categoryById(slug)
  if (!category) return {}
  return {
    title: `${category.emoji} ${category.label}`,
    description: `DSH plugins in the ${category.label} category`,
  }
}

async function Listing({
  slug,
  searchParams,
}: {
  slug: string
  searchParams: Props["searchParams"]
}) {
  const loaded = await loadSearchParams.parse(searchParams)
  const { plugins, total, pageCount } = await searchPlugins({
    ...loaded,
    category: [slug],
  })
  return (
    <PluginListing
      plugins={plugins}
      total={total}
      pageCount={pageCount}
      view={loaded.view}
      hideCategoryFilter
      lockedCategory={[slug]}
    />
  )
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const category = categoryById(slug)
  if (!category) notFound()

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">
        <span aria-hidden className="mr-2">
          {category.emoji}
        </span>
        {category.label}
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">{category.labelZh}</p>

      <Suspense>
        <Listing slug={slug} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
