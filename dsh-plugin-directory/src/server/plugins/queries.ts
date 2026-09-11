import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"

export type PluginWithCategory = Prisma.PluginGetPayload<{ include: { category: true } }>

export interface PluginSearchInput {
  q: string
  category: string[]
  sort: string
  /** UI-only (grid | list); parsed from the URL but ignored by the query. */
  view?: string
  page: number
  perPage: number
}

const SORTS: Record<string, Prisma.PluginOrderByWithRelationInput[]> = {
  "stars.desc": [{ stars: "desc" }, { name: "asc" }],
  "stars.asc": [{ stars: "asc" }, { name: "asc" }],
  "added.desc": [{ publishedAt: { sort: "desc", nulls: "last" } }, { stars: "desc" }],
  "added.asc": [{ publishedAt: { sort: "asc", nulls: "last" } }, { stars: "desc" }],
  "name.asc": [{ name: "asc" }],
  "name.desc": [{ name: "desc" }],
}

export async function searchPlugins({ q, category, sort, page, perPage }: PluginSearchInput) {
  const where: Prisma.PluginWhereInput = {
    status: "Published",
    ...(category.length > 0 ? { bundleCategory: { in: category } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { tagline: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const orderBy = SORTS[sort] ?? SORTS["stars.desc"]

  const [plugins, total] = await Promise.all([
    db.plugin.findMany({
      where,
      include: { category: true },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.plugin.count({ where }),
  ])

  return { plugins, total, pageCount: Math.ceil(total / perPage) }
}

export async function findPlugin(slug: string) {
  return db.plugin.findFirst({
    where: { slug, status: "Published" },
    include: { category: true },
  })
}

export async function findRelatedPlugins(plugin: PluginWithCategory, take = 6) {
  return db.plugin.findMany({
    where: { status: "Published", bundleCategory: plugin.bundleCategory, id: { not: plugin.id } },
    include: { category: true },
    orderBy: [{ stars: "desc" }],
    take,
  })
}

export async function findCategories() {
  const categories = await db.category.findMany({
    include: { _count: { select: { plugins: { where: { status: "Published" } } } } },
  })
  // keep the canonical awesome-dsh-plugin ordering (as seeded)
  return categories
}

export async function findPluginSlugs() {
  const rows = await db.plugin.findMany({
    where: { status: "Published" },
    select: { slug: true },
  })
  return rows.map((r) => r.slug)
}

export async function getStats() {
  const [total, categories] = await Promise.all([
    db.plugin.count({ where: { status: "Published" } }),
    db.category.count(),
  ])
  return { total, categories }
}
