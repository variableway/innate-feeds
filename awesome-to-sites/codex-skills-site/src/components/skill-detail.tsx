import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SkillCard } from "@/components/skill-card";
import {
  ArrowLeft,
  ExternalLink,
  Package,
  Copy,
  Terminal,
  Tag,
} from "lucide-react";
import type { Skill } from "@/data/skills";

interface SkillDetailProps {
  skill: Skill;
  categoryName: string;
  related: Skill[];
}

export function SkillDetail({ skill, categoryName, related }: SkillDetailProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all skills
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            {skill.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {skill.name}
              </h1>
              {skill.isLocal ? (
                <Badge variant="secondary" className="gap-1">
                  <Package className="h-3 w-3" />
                  Built-in
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  External
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{categoryName}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed text-muted-foreground">
            {skill.description}
          </p>
          {skill.shortDescription &&
            skill.shortDescription !== skill.description && (
              <p className="mt-3 text-sm italic text-muted-foreground/70">
                {skill.shortDescription}
              </p>
            )}
        </CardContent>
      </Card>

      {/* Install / Source */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            {skill.isLocal ? "Installation" : "Source"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {skill.isLocal ? (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                This skill is bundled with the awesome-codex-skills repository.
                Install it with:
              </p>
              <div className="relative rounded-lg bg-muted/50 p-4 font-mono text-sm">
                <code>
                  git clone
                  https://github.com/ComposioHQ/awesome-codex-skills.git
                  <br />
                  cd awesome-codex-skills
                  <br />
                  cp -r {skill.slug} ~/.codex/skills/
                </code>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {skill.repoUrl && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    Repository:
                  </p>
                  <a
                    href={skill.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {skill.repoUrl}
                  </a>
                </div>
              )}
              {skill.installCommand && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    Install command:
                  </p>
                  <div className="relative rounded-lg bg-muted/50 p-4 font-mono text-sm">
                    <code>{skill.installCommand}</code>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      {skill.tags.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Tag className="h-4 w-4" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {skill.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related skills */}
      {related.length > 0 && (
        <>
          <Separator className="mb-8" />
          <div>
            <h2 className="mb-4 text-lg font-semibold">
              More in {categoryName}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <SkillCard key={s.slug} skill={s} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
