import Link from "next/link";
import { categories } from "@/data/skills";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Categories
            </h3>
            <ul className="space-y-2">
              {categories
                .filter((c) => c.id !== "all")
                .map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={`/?category=${cat.id}`}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Resources
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/ComposioHQ/awesome-codex-skills#creating-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Creating Skills
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/ComposioHQ/awesome-codex-skills#contributing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Contributing
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/ComposioHQ/awesome-codex-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Community
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://discord.com/invite/composio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Discord
                </a>
              </li>
              <li>
                <a
                  href="https://twitter.com/composio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  X (Twitter)
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/composiohq/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              About
            </h3>
            <p className="text-sm text-muted-foreground">
              A curated collection of awesome lists converted to browsable
              websites. Built by the community.
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-border/40 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Data sourced from{" "}
            <a
              href="https://github.com/ComposioHQ/awesome-codex-skills"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              ComposioHQ/awesome-codex-skills
            </a>
            . Not affiliated with OpenAI.
          </p>
        </div>
      </div>
    </footer>
  );
}
