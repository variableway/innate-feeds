import { Download, ExternalLink, Star } from "lucide-react";
import { EDU_CATEGORY_BY_ID } from "../../../shared/edu-categories";
import { formatNumber } from "../lib/format";
import type { EduSkill } from "../types/edu";
import { CopyButton } from "./copy-button";

/** 单个教育动画 SKILL 卡片。 */
export function SkillCard({ skill }: { skill: EduSkill }) {
  const primaryCategory = skill.categories[0];
  const category = primaryCategory
    ? EDU_CATEGORY_BY_ID[primaryCategory]
    : undefined;

  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight break-words">
            {skill.title}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
            {skill.owner}/{skill.repo} · {skill.skill}
          </p>
        </div>
        {skill.relevance === "core" ? (
          <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            Core
          </span>
        ) : null}
      </div>

      {skill.tagline ? (
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {skill.tagline}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span
          className="inline-flex items-center gap-1"
          title="skills.sh 安装量"
        >
          <Download className="h-3.5 w-3.5" />
          {formatNumber(skill.installs)}
        </span>
        <span className="inline-flex items-center gap-1" title="GitHub stars">
          <Star className="h-3.5 w-3.5" />
          {skill.stars === null ? "—" : formatNumber(skill.stars)}
        </span>
        {skill.license ? (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
            {skill.license}
          </span>
        ) : null}
        {skill.archived ? (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
            archived
          </span>
        ) : null}
      </div>

      {category ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          <span aria-hidden>{category.emoji}</span>
          {category.labelZh}
        </span>
      ) : null}

      <div className="mt-auto flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1">
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {skill.installCommand}
        </code>
        <CopyButton text={skill.installCommand} label="复制安装命令" />
      </div>

      <div className="flex items-center gap-3 text-xs">
        <a
          href={skill.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          skills.sh
        </a>
        <a
          href={skill.repoUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>
    </article>
  );
}
