import { Badge } from "@/components/ui/badge";
import { Sparkles, Layers, Star } from "lucide-react";

interface HeroSectionProps {
  totalSkills: number;
  categoryCounts: Record<string, number>;
}

export function HeroSection({ totalSkills, categoryCounts }: HeroSectionProps) {
  const categoryCount = Object.keys(categoryCounts).filter(
    (k) => k !== "all"
  ).length;

  return (
    <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background via-background to-muted/30">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] rounded-full bg-chart-2/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Sparkles className="h-3 w-3" />
            Open Source Awesome Lists Collection
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            AI Skills{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              Marketplace
            </span>
          </h1>

          <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
            Discover open-source AI skills, tools, and resources from curated
            awesome lists. Automate workflows across 1000+ apps.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                {totalSkills.toLocaleString()}
              </span>
              <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Skills
              </span>
            </div>

            <div className="h-10 w-px bg-border" />

            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                {categoryCount}
              </span>
              <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Categories
              </span>
            </div>

            <div className="h-10 w-px bg-border" />

            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                1000+
              </span>
              <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-3.5 w-3.5" />
                App Integrations
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
