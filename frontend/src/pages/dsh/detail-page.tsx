import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Calendar, Package, Star } from "lucide-react";
import { pluginCategoryById } from "@innate/shared/plugin-categories";
import { fetchPlugin, fetchRelatedPlugins } from "@/services/plugins";
import { PluginCard } from "@/components/plugin-card";
import { CopyInstallButton } from "@/components/copy-install-button";
import { MarkdownBody } from "@/components/markdown-body";
import type { DshPlugin } from "@/types/plugin";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DshPluginDetailPage() {
  const { slug } = useParams({ from: "/dsh/plugins/$slug" });
  const [plugin, setPlugin] = useState<DshPlugin | null>(null);
  const [related, setRelated] = useState<DshPlugin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPlugin(slug)
      .then((item) => {
        if (cancelled) return;
        setPlugin(item);
        setError(item ? null : "Plugin not found");
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    void fetchRelatedPlugins(slug).then((items) => {
      if (!cancelled) setRelated(items);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-destructive">{error}</p>
        <Link to="/dsh" className="mt-4 inline-block text-sm text-primary">
          ← All plugins
        </Link>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const category = pluginCategoryById(plugin.bundleCategory);
  const screenshots = [plugin.screenshotUrl, ...plugin.screenshots].filter(
    (src): src is string => Boolean(src),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/dsh"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All plugins
        </Link>

        <header className="mt-4">
          <h1 className="font-mono text-2xl font-bold tracking-tight break-all sm:text-3xl">
            {plugin.name}
          </h1>
          {plugin.tagline ? (
            <p className="mt-2 text-lg">{plugin.tagline}</p>
          ) : null}
          {plugin.taglineZh ? (
            <p className="mt-1 text-muted-foreground">{plugin.taglineZh}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {category ? (
              <Link
                to="/dsh/categories/$slug"
                params={{ slug: category.id }}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                <span aria-hidden>{category.emoji}</span>
                {category.label}
              </Link>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
              <Star className="h-3.5 w-3.5" />
              {plugin.stars.toLocaleString()} stars
            </span>
            {plugin.publishedAt ? (
              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                Added {formatDate(plugin.publishedAt)}
              </span>
            ) : null}
          </div>

          {plugin.installCommand ? (
            <div className="mt-6 flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3">
              <code className="flex-1 overflow-x-auto font-mono text-sm whitespace-nowrap">
                {plugin.installCommand}
              </code>
              <CopyInstallButton text={plugin.installCommand} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={plugin.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Repository
            </a>
            {plugin.npmPackage ? (
              <a
                href={`https://www.npmjs.com/package/${plugin.npmPackage}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Package className="h-4 w-4" />
                npm
              </a>
            ) : null}
            {plugin.tarballUrl ? (
              <a
                href={plugin.tarballUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Package className="h-4 w-4" />
                Tarball
              </a>
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
                  className="aspect-video overflow-hidden rounded-lg border bg-muted"
                >
                  <img
                    src={src}
                    alt={`${plugin.name} screenshot`}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {plugin.content ? (
          <section className="mt-8">
            <MarkdownBody markdown={plugin.content} />
          </section>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section className="mt-14">
          <h2 className="mb-4 text-lg font-semibold">Related plugins</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <PluginCard key={item.slug} plugin={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
