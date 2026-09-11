import { siteConfig } from "@/config/site"

export function SiteFooter() {
  return (
    <footer className="border-t py-6 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 text-center sm:px-6">
        <p>
          Not affiliated with DeepSeek. Data from the{" "}
          <a
            href={siteConfig.links.awesomeList}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            awesome-dsh-plugin
          </a>{" "}
          list.
        </p>
      </div>
    </footer>
  )
}
