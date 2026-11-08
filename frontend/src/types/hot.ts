/**
 * GitHub Hot types (GH #63). Mirrors backend/src/curation/heat.ts DTOs.
 */

export interface HotSignal {
  source: "trending" | "trendshift" | "digest" | "github-new";
  label?: string;
  rank?: number;
  seenAt: string;
  weight: number;
}

export interface HotItem {
  fullName: string;
  heat: number;
  rank: number;
  stars: number | null;
  starsGained: number | null;
  description: string | null;
  language: string | null;
  ownerLogin: string;
  ownerAvatarUrl: string;
  signals: HotSignal[];
  isNew: boolean;
}

export interface HotSnapshotDTO {
  snapshotDate: string;
  ruleVersion: string;
  generatedAt: string;
  items: HotItem[];
}
