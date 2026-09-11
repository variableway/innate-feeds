import Image from "next/image"
import Link from "next/link"

import { GithubIcon } from "@/components/icons"
import { ThemeToggle } from "@/components/theme-toggle"
import { VariantSelector } from "@/components/variant-selector"
import { siteConfig } from "@/config/site"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/badge.svg" alt="" width={24} height={24} />
          <span className="hidden sm:inline-block">{siteConfig.name}</span>
        </Link>
        <nav className="flex flex-1 items-center gap-4 text-sm text-muted-foreground">
          <a href="/" className="transition-colors hover:text-foreground">
            Feeds
          </a>
          <Link href="/" className="transition-colors hover:text-foreground">
            Plugins
          </Link>
          <Link href="/categories" className="transition-colors hover:text-foreground">
            Categories
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <VariantSelector />
          <a
            href={siteConfig.links.awesomeList}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <GithubIcon className="size-4" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
