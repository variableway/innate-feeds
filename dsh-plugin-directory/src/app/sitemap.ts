import type { MetadataRoute } from "next"

import { siteConfig } from "@/config/site"
import { CATEGORIES } from "@/lib/categories"
import { findPluginSlugs } from "@/server/plugins/queries"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await findPluginSlugs()

  return [
    { url: siteConfig.url, changeFrequency: "daily", priority: 1 },
    { url: `${siteConfig.url}/categories`, changeFrequency: "weekly", priority: 0.8 },
    ...CATEGORIES.map((c) => ({
      url: `${siteConfig.url}/categories/${c.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...slugs.map((slug) => ({
      url: `${siteConfig.url}/plugins/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ]
}
