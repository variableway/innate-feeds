import Firecrawl from "firecrawl";
import { createHash } from "crypto";
import type { GitHubRepo } from "./github.js";

export type TrendingPeriod = "daily" | "weekly" | "monthly";

interface TrendingRepo {
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: string;
  forks: string;
  starsToday: string;
}

export async function fetchTrendingWithFirecrawl(
  period: TrendingPeriod = "daily",
  language?: string,
): Promise<GitHubRepo[]> {
  const firecrawl = new Firecrawl();

  let url = "https://github.com/trending";
  if (language) url += `/${language}`;
  if (period !== "daily") url += `?since=${period}`;

  console.log(`Fetching ${period} trending from ${url} using Firecrawl...`);

  try {
    const result = await firecrawl.scrape(url, {
      formats: [
        {
          type: "json",
          schema: {
            type: "object",
            properties: {
              repos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    fullName: { type: "string" },
                    description: { type: "string" },
                    url: { type: "string" },
                    language: { type: "string" },
                    stars: { type: "string" },
                    forks: { type: "string" },
                    starsToday: { type: "string" },
                  },
                  required: ["fullName"],
                },
              },
            },
          },
        },
      ],
    });

    // @ts-ignore Firecrawl SDK typing gap.
    const data = result.json as { repos?: TrendingRepo[] };
    if (!data || !data.repos) {
      console.log("No trending repos found via Firecrawl");
      return [];
    }

    const repos: GitHubRepo[] = data.repos.map((repo: TrendingRepo) => {
      const [owner, name] = (repo.fullName || "").split("/");
      return {
        id: generateRepoId(repo.fullName),
        name: name || repo.name,
        full_name: repo.fullName,
        description: repo.description || null,
        html_url: repo.url || `https://github.com/${repo.fullName}`,
        homepage: null,
        stargazers_count: parseStarCount(repo.stars),
        forks_count: parseStarCount(repo.forks),
        watchers_count: 0,
        language: repo.language || null,
        topics: [],
        owner: {
          login: owner,
          avatar_url: `https://github.com/${owner}.png`,
          html_url: `https://github.com/${owner}`,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    return repos;
  } catch (err) {
    console.error("Firecrawl error:", err);
    return [];
  }
}

function generateRepoId(fullName: string): number {
  const hash = createHash("sha256").update(fullName).digest();
  // Use the first 6 bytes (48 bits) as a positive integer to fit in SQLite INTEGER.
  const value = hash.readUIntBE(0, 6);
  return value;
}

function parseStarCount(stars: string): number {
  if (!stars) return 0;

  const cleaned = stars.replace(/,/g, "").trim();
  if (cleaned.endsWith("k")) return Math.round(parseFloat(cleaned) * 1000);
  if (cleaned.endsWith("m")) return Math.round(parseFloat(cleaned) * 1000000);

  return parseInt(cleaned, 10) || 0;
}
