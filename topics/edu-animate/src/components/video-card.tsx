import { Clock, Eye, Play, Calendar } from "lucide-react";
import { EDU_CATEGORY_BY_ID } from "../../../../shared/edu-categories";
import { formatDate, formatDuration, formatNumber } from "../lib/format";
import type { EduVideo } from "../types/edu";

/** 单个教学视频卡片（只展示元数据与链接，不内嵌播放器）。 */
export function VideoCard({ video }: { video: EduVideo }) {
  const primaryCategory = video.categories[0];
  const category = primaryCategory
    ? EDU_CATEGORY_BY_ID[primaryCategory]
    : undefined;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/20">
      <a
        href={video.url}
        target="_blank"
        rel="noreferrer noopener"
        className="group relative block aspect-video w-full overflow-hidden bg-muted"
      >
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center bg-background/30 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90">
            <Play className="h-4 w-4 fill-foreground" />
          </span>
        </span>
        {video.durationSeconds !== null ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
            {formatDuration(video.durationSeconds)}
          </span>
        ) : null}
      </a>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:underline"
          >
            {video.title}
          </a>
        </h3>

        <p className="text-xs text-muted-foreground">{video.channelTitle}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="播放量">
            <Eye className="h-3.5 w-3.5" />
            {video.views === null ? "—" : formatNumber(video.views)}
          </span>
          <span className="inline-flex items-center gap-1" title="时长">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(video.durationSeconds)}
          </span>
          {video.publishedAt ? (
            <span className="inline-flex items-center gap-1" title="发布时间">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(video.publishedAt)}
            </span>
          ) : null}
        </div>

        {category ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            <span aria-hidden>{category.emoji}</span>
            {category.labelZh}
          </span>
        ) : null}

        {video.note ? (
          <p className="mt-auto text-xs leading-relaxed text-muted-foreground/90">
            {video.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
