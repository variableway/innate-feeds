import type { Metadata } from "next"
import { Suspense } from "react"

import { PluginListing } from "@/components/plugin-listing"
import { siteConfig } from "@/config/site"
import { getStats, searchPlugins } from "@/server/plugins/queries"
import { loadSearchParams } from "@/server/plugins/search-params"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
}

async function Listing({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await loadSearchParams.parse(searchParams)
  const { plugins, total, pageCount } = await searchPlugins(params)
  return (
    <PluginListing plugins={plugins} total={total} pageCount={pageCount} view={params.view} />
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const stats = await getStats()

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <section className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{siteConfig.name}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{siteConfig.description}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats.total} plugins across {stats.categories} categories
        </p>
      </section>

      <Suspense>
        <Listing searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
