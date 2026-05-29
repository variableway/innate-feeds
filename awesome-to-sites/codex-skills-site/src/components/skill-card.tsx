import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExternalLink, Package } from "lucide-react";
import type { Skill } from "@/data/skills";

const categoryColors: Record<string, string> = {
  development: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  productivity: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  communication: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  data: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  meta: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

const categoryLabels: Record<string, string> = {
  development: "Dev Tools",
  productivity: "Productivity",
  communication: "Writing",
  data: "Data",
  meta: "Utilities",
};

export function SkillCard({ skill }: { skill: Skill }) {
  const colorClass = categoryColors[skill.category] || categoryColors.meta;
  const label = categoryLabels[skill.category] || skill.category;

  return (
    <Link href={`/skills/${skill.slug}`} className="group block">
      <Card className="h-full transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
                {skill.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="truncate text-sm font-semibold group-hover:text-primary">
                {skill.name}
              </h3>
            </div>
            {skill.isLocal ? (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                <Package className="mr-1 h-3 w-3" />
                Built-in
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                <ExternalLink className="mr-1 h-3 w-3" />
                External
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {skill.shortDescription || skill.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className={`text-[10px] ${colorClass}`}
            >
              {label}
            </Badge>
            {skill.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px]"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
