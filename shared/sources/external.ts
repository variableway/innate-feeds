/**
 * External source registry — data part (S4, GH #31).
 * 单一真相：加一个外部源从「改 4 处」降到「改 2 处」（本文件 + 前端 UI 覆盖层）。
 * 边界：只放数据（id/标题/描述/首页），不放 icon 等表现层关注点；
 * 数组顺序 = 展示顺序（排序权重隐含在顺序里）。
 */
import type { FeedSource } from "../types/external.js";

export interface ExternalSourceDefinition {
  source: FeedSource;
  title: string;
  description: string;
  homepage: string;
}

/** Sources served by /api/external* (trendshift/topics/awesome-dsh have their own APIs). */
export const EXTERNAL_SOURCES: ExternalSourceDefinition[] = [
  {
    source: "producthunt",
    title: "Product Hunt",
    description: "每日/周/月新品榜",
    homepage: "https://www.producthunt.com/leaderboard",
  },
  {
    source: "yc",
    title: "YC Companies",
    description: "Y Combinator 公司库（按 batch）",
    homepage: "https://www.ycombinator.com/companies",
  },
  {
    source: "a16z",
    title: "a16z Portfolio",
    description: "a16z AI 投资组合 + GitHub 补充",
    homepage: "https://a16z.com/ai/",
  },
  {
    source: "hackernews",
    title: "Hacker News",
    description: "HN 首页热帖（Algolia API）",
    homepage: "https://news.ycombinator.com",
  },
  {
    source: "huggingface",
    title: "Hugging Face",
    description: "HF Trending 模型/数据集/Spaces",
    homepage: "https://huggingface.co",
  },
  {
    source: "github-new",
    title: "GitHub New",
    description: "近 N 天新建且快速增长的开源仓库",
    homepage: "https://github.com/search",
  },
  {
    source: "devto",
    title: "Dev.to",
    description: "Dev.to 热门技术文章",
    homepage: "https://dev.to",
  },
  {
    source: "lobsters",
    title: "lobste.rs",
    description: "Lobsters 最热讨论",
    homepage: "https://lobste.rs",
  },
  {
    source: "edu-skills",
    title: "Edu Skills",
    description: "教育动画领域的 Agent Skill（skills.sh 索引）",
    homepage: "https://www.skills.sh",
  },
  {
    source: "edu-videos",
    title: "Edu Videos",
    description: "教育动画领域的教学视频（策展频道）",
    homepage: "https://www.youtube.com",
  },
];
