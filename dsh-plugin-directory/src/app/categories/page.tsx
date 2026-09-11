import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardContent } from "@/components/ui/card"
import { categoryById } from "@/lib/categories"
import { findCategories } from "@/server/plugins/queries"

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse DSH plugins by category",
}

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const categories = await findCategories()

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
      <p className="mt-2 text-muted-foreground">Browse plugins by category.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const meta = categoryById(c.id)
          return (
            <Link key={c.id} href={`/categories/${c.id}`} className="group block">
              <Card className="h-full transition-colors group-hover:border-foreground/20">
                <CardContent className="flex items-center gap-3 px-4">
                  <span className="text-2xl" aria-hidden>
                    {c.emoji ?? meta?.emoji}
                  </span>
                  <div>
                    <p className="font-medium">{c.label || meta?.label || c.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {c._count.plugins} {c._count.plugins === 1 ? "plugin" : "plugins"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
