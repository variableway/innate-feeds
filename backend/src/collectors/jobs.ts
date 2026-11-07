/**
 * M-Sync 任务注册表 —— 数据收集模块的代码级单一事实源（sprint-3 task-A1）。
 *
 * 每个采集/同步小模块一条记录：id 唯一、group 对应 collectors/ 分组、
 * args 为 `cli sync` 的规范参数（args[0] 即 sync 子命令）。
 * 新增采集器 = 实现模块 + 在此登记一条 job；`cli sync jobs` 自动可见。
 */

export type SyncJobGroup = "core" | "external" | "topics" | "vertical" | "pipeline";

export interface SyncJob {
  id: string;
  group: SyncJobGroup;
  summary: string;
  /** `bun src/app/cli.ts sync <args...>` 的规范参数 */
  args: string[];
  /** 产出位置（~/.innate 下目录或 SQLite） */
  outputs: string;
}

export const SYNC_JOBS: SyncJob[] = [
  // ---- core：GitHub 系（写 SQLite feeds.db）----
  {
    id: "trending-daily",
    group: "core",
    summary: "GitHub Trending daily 快照",
    args: ["trending", "daily"],
    outputs: "SQLite trending_repos",
  },
  {
    id: "trending-all",
    group: "core",
    summary: "GitHub Trending daily+weekly+monthly 全量快照",
    args: ["all-trending"],
    outputs: "SQLite trending_repos",
  },
  {
    id: "starred-recent",
    group: "core",
    summary: "本人 starred 增量同步（停在已同步条目）",
    args: ["starred"],
    outputs: "SQLite starred_repos",
  },
  {
    id: "digest",
    group: "core",
    summary: "仓库 issues 精选 90 天窗口抓取",
    args: ["digest", "--days", "90"],
    outputs: "~/.innate/digest",
  },
  // ---- external：外部 JSON 源（各自独立目录）----
  {
    id: "producthunt",
    group: "external",
    summary: "Product Hunt 日/周/月榜单（Firecrawl）",
    args: ["producthunt"],
    outputs: "~/.innate/producthunt",
  },
  {
    id: "yc",
    group: "external",
    summary: "Y Combinator 公司库（公开 API）",
    args: ["yc"],
    outputs: "~/.innate/yc",
  },
  {
    id: "a16z",
    group: "external",
    summary: "a16z AI 组合 + GitHub 补充",
    args: ["a16z"],
    outputs: "~/.innate/a16z",
  },
  {
    id: "hackernews",
    group: "external",
    summary: "Hacker News 首页热帖（Algolia）",
    args: ["hackernews"],
    outputs: "~/.innate/hackernews",
  },
  {
    id: "huggingface",
    group: "external",
    summary: "Hugging Face trending（本机网络可能超时，属预期）",
    args: ["huggingface"],
    outputs: "~/.innate/huggingface",
  },
  {
    id: "github-new",
    group: "external",
    summary: "近 N 天新建高星仓库（GitHub Search）",
    args: ["github-new"],
    outputs: "~/.innate/github-new",
  },
  {
    id: "devto",
    group: "external",
    summary: "Dev.to 热门文章",
    args: ["devto"],
    outputs: "~/.innate/devto",
  },
  {
    id: "lobsters",
    group: "external",
    summary: "lobste.rs 最热讨论",
    args: ["lobsters"],
    outputs: "~/.innate/lobsters",
  },
  {
    id: "trendshift",
    group: "external",
    summary: "Trendshift 榜单归档（daily/weekly/monthly/yearly）",
    args: ["trendshift"],
    outputs: "~/.innate/trendshift",
  },
  // ---- topics：主题检索源 ----
  {
    id: "github-topics",
    group: "topics",
    summary: "GitHub Topics top-N 快照（配置清单见 topics:list）",
    args: ["github-topics"],
    outputs: "~/.innate/github-topics/topics",
  },
  // ---- vertical：垂直域源 ----
  {
    id: "awesome-dsh",
    group: "vertical",
    summary: "Awesome DSH 市场目录 + GraphQL Stars 富化",
    args: ["awesome-dsh"],
    outputs: "~/.innate/awesome-dsh",
  },
  {
    id: "edu-skills",
    group: "vertical",
    summary: "教育动画 SKILL 采集（skills.sh，较慢）",
    args: ["edu-skills"],
    outputs: "~/.innate/edu-skills",
  },
  {
    id: "edu-videos",
    group: "vertical",
    summary: "教育动画教学视频（需 YOUTUBE_API_KEY）",
    args: ["edu-videos"],
    outputs: "~/.innate/edu-videos",
  },
  // ---- pipeline：编排（组合上述 job）----
  {
    id: "window",
    group: "pipeline",
    summary: "90 天全量窗口（trending+starred+digest+README 预取）",
    args: ["window"],
    outputs: "SQLite + ./readmes + public/data",
  },
  {
    id: "vc-external",
    group: "pipeline",
    summary: "外部源统一编排（per-source 失败不中断）",
    args: ["vc"],
    outputs: "~/.innate/{各源目录}",
  },
];

export function findSyncJob(id: string): SyncJob | undefined {
  return SYNC_JOBS.find((j) => j.id === id);
}
