import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { marked } from "marked"
import { Calendar, Package, Star } from "lucide-react"

import { CopyButton } from "@/components/copy-button"
import { GithubIcon } from "@/components/icons"
import { PluginCard } from "@/components/plugin-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { categoryById } from "@/lib/categories"
import { siteConfig } from "@/config/site"
import {
  findPlugin,
  findPluginSlugs,
  findRelatedPlugins,
} from "@/server/plugins/queries"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await findPluginSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const plugin = await findPlugin(slug)
  if (!plugin) return {}

  const description = plugin.tagline ?? plugin.description ?? siteConfig.description
  return {
    title: plugin.name,
    description,
    openGraph: {
      title: plugin.name,
      description,
      type: "article",
      ...(plugin.screenshotUrl ? { images: [{ url: plugin.screenshotUrl }] } : {}),
    },
  }
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default async function PluginDetailPage({ params }: Props) {
  const { slug } = await params
  const plugin = await findPlugin(slug)
  if (!plugin) notFound()

  const category = plugin.bundleCategory ? categoryById(plugin.bundleCategory) : undefined
  const related = await findRelatedPlugins(plugin)
  const screenshots = [plugin.screenshotUrl, ...plugin.screenshots].filter(
    (s): s is string => Boolean(s)
  )
  const contentHtml = plugin.content ? marked.parse(plugin.content, { async: false }) : null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: plugin.name,
    description: plugin.tagline ?? plugin.description ?? undefined,
    url: `${siteConfig.url}/plugins/${plugin.slug}`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    ...(plugin.screenshotUrl ? { screenshot: plugin.screenshotUrl } : {}),
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All plugins
        </Link>

        <header className="mt-4">
          <h1 className="font-mono text-2xl font-bold tracking-tight break-all sm:text-3xl">
            {plugin.name}
          </h1>
          {plugin.tagline ? <p className="mt-2 text-lg">{plugin.tagline}</p> : null}
          {plugin.taglineZh ? (
            <p className="mt-1 text-muted-foreground">{plugin.taglineZh}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {category ? (
              <Link href={`/categories/${category.id}`}>
                <Badge variant="secondary" className="font-normal">
                  <span aria-hidden>{category.emoji}</span>
                  {category.label}
                </Badge>
              </Link>
            ) : null}
            <Badge variant="outline" className="font-normal">
              <Star className="size-3.5" />
              {plugin.stars.toLocaleString()} stars
            </Badge>
            {plugin.publishedAt ? (
              <Badge variant="outline" className="font-normal">
                <Calendar className="size-3.5" />
                Added {formatDate(plugin.publishedAt)}
              </Badge>
            ) : null}
          </div>

          {plugin.installCommand ? (
            <div className="mt-6 flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3">
              <code className="flex-1 overflow-x-auto font-mono text-sm whitespace-nowrap">
                {plugin.installCommand}
              </code>
              <CopyButton text={plugin.installCommand} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={
                <a href={plugin.repositoryUrl} target="_blank" rel="noreferrer" />
              }
            >
              <GithubIcon className="size-4" />
              Repository
            </Button>
            {plugin.npmPackage ? (
              <Button
                variant="outline"
                render={
                  <a
                    href={`https://www.npmjs.com/package/${plugin.npmPackage}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <Package className="size-4" />
                npm
              </Button>
            ) : null}
            {plugin.tarballUrl ? (
              <Button
                variant="outline"
                render={<a href={plugin.tarballUrl} target="_blank" rel="noreferrer" />}
              >
                <Package className="size-4" />
                Tarball
              </Button>
            ) : null}
          </div>
        </header>

        {screenshots.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Screenshots</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {screenshots.map((src) => (
                <div
                  key={src}
                  className="relative aspect-video overflow-hidden rounded-lg border bg-muted"
                >
                  <Image
                    src={src}
                    alt={`${plugin.name} screenshot`}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover object-top"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {contentHtml ? (
          <section className="mt-8">
            <div
              className="markdown"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </section>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section className="mt-14">
          <h2 className="mb-4 text-lg font-semibold">Related plugins</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PluginCard key={p.id} plugin={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
