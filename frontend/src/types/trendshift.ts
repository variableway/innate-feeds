/** Trendshift ranking types (GH #23). Mirrors the backend collector's normalized rows. */

export const TRENDSHIFT_TIMEFRAMES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;
export type TrendshiftTimeframe = (typeof TRENDSHIFT_TIMEFRAMES)[number];

export const TRENDSHIFT_TIMEFRAME_LABELS: Record<TrendshiftTimeframe, string> =
  {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };

export const TRENDSHIFT_LANGUAGES = [
  "all",
  "c",
  "csharp",
  "cpp",
  "dart",
  "go",
  "java",
  "javascript",
  "kotlin",
  "php",
  "python",
  "ruby",
  "rust",
  "swift",
  "typescript",
  "zig",
] as const;
export type TrendshiftLanguageFilter = (typeof TRENDSHIFT_LANGUAGES)[number];

export const TRENDSHIFT_LANGUAGE_LABELS: Record<
  TrendshiftLanguageFilter,
  string
> = {
  all: "All",
  c: "C",
  csharp: "C#",
  cpp: "C++",
  dart: "Dart",
  go: "Go",
  java: "Java",
  javascript: "JavaScript",
  kotlin: "Kotlin",
  php: "PHP",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  swift: "Swift",
  typescript: "TypeScript",
  zig: "Zig",
};

export interface TrendshiftRepo {
  periodKey: string;
  rank: number;
  score: number | null;
  fullName: string;
  githubUrl: string;
  description: string;
  language: string | null;
  starsTotal: number | null;
  starsGained: number | null;
  forksTotal: number | null;
  forksGained: number | null;
  createdAt: string | null;
  tags: string[];
  socialMentionPlatforms: string[];
  timeframe: TrendshiftTimeframe;
  languageFilter: TrendshiftLanguageFilter;
}

export type TrendshiftSort = "rank" | "stars-gained" | "stars-total" | "newest";

export const TRENDSHIFT_SORT_LABELS: Record<TrendshiftSort, string> = {
  rank: "Rank",
  "stars-gained": "Most stars gained",
  "stars-total": "Most stars",
  newest: "Newest repos",
};
