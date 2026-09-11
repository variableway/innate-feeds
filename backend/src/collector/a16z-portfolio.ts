/**
 * a16z AI Portfolio collector.
 *
 * Uses a curated static list of a16z AI investments, enriched with
 * GitHub API data for open-source projects.
 *
 * Run:
 *   bunx tsx src/collector/a16z-portfolio.ts
 *   bunx tsx src/collector/a16z-portfolio.ts --save
 */

import { fetchJson } from "./shared/http.js";
import { saveItems } from "./shared/storage.js";
import type {
  ExternalFeedItem,
  FeedCollector,
  SaveResult,
} from "./shared/types.js";

interface CompanyEntry {
  name: string;
  website: string;
  github: string | null;
  tags: string[];
  description?: string;
}

const A16Z_AI_COMPANIES: CompanyEntry[] = [
  // Foundation Models
  {
    name: "OpenAI",
    website: "https://openai.com",
    github: "openai",
    tags: ["LLM", "Foundation Model"],
  },
  {
    name: "Mistral AI",
    website: "https://mistral.ai",
    github: "mistralai",
    tags: ["LLM", "Open Source"],
  },
  {
    name: "xAI",
    website: "https://x.ai",
    github: "xai-org",
    tags: ["LLM"],
  },
  {
    name: "Safe Superintelligence",
    website: "https://safe.ai",
    github: null,
    tags: ["Safety"],
  },

  // AI Applications
  {
    name: "Character.AI",
    website: "https://character.ai",
    github: null,
    tags: ["Chatbot", "Consumer"],
  },
  {
    name: "Cursor",
    website: "https://cursor.com",
    github: null,
    tags: ["IDE", "Coding"],
  },
  {
    name: "Harvey",
    website: "https://harvey.ai",
    github: null,
    tags: ["Legal", "Enterprise"],
  },
  {
    name: "Hebbia",
    website: "https://hebbia.ai",
    github: null,
    tags: ["Knowledge", "Enterprise"],
  },
  {
    name: "ElevenLabs",
    website: "https://elevenlabs.io",
    github: null,
    tags: ["Voice", "Audio"],
  },
  {
    name: "Ideogram",
    website: "https://ideogram.ai",
    github: null,
    tags: ["Image Generation"],
  },
  {
    name: "Runway",
    website: "https://runwayml.com",
    github: null,
    tags: ["Video Generation"],
  },
  {
    name: "Gamma",
    website: "https://gamma.app",
    github: null,
    tags: ["Productivity", "Presentations"],
  },
  {
    name: "World Labs",
    website: "https://worldlabs.ai",
    github: null,
    tags: ["Spatial Intelligence"],
  },
  {
    name: "Luma AI",
    website: "https://lumalabs.ai",
    github: null,
    tags: ["3D", "Video Generation"],
  },
  {
    name: "Krea",
    website: "https://krea.ai",
    github: null,
    tags: ["Image Generation", "Creative"],
  },

  // Infrastructure
  {
    name: "Databricks",
    website: "https://databricks.com",
    github: "databricks",
    tags: ["Data", "ML Platform"],
  },
  {
    name: "Anyscale",
    website: "https://anyscale.com",
    github: "anyscale",
    tags: ["Distributed Computing"],
  },
  {
    name: "Replicate",
    website: "https://replicate.com",
    github: "replicate",
    tags: ["Model Serving"],
  },
  {
    name: "Pinecone",
    website: "https://pinecone.io",
    github: null,
    tags: ["Vector Database"],
  },
  {
    name: "Fal.ai",
    website: "https://fal.ai",
    github: null,
    tags: ["Media AI"],
  },
  {
    name: "Exa",
    website: "https://exa.ai",
    github: null,
    tags: ["Search"],
  },
  {
    name: "OpenRouter",
    website: "https://openrouter.ai",
    github: null,
    tags: ["LLM Gateway"],
  },
  {
    name: "Hugging Face",
    website: "https://huggingface.co",
    github: "huggingface",
    tags: ["Model Hub", "Open Source"],
  },

  // Developer Tools
  {
    name: "Sourcegraph",
    website: "https://sourcegraph.com",
    github: "sourcegraph",
    tags: ["Code Search", "AI Coding"],
  },
  {
    name: "Promptfoo",
    website: "https://promptfoo.dev",
    github: "promptfoo",
    tags: ["LLM Evaluation"],
  },
  {
    name: "Black Forest Labs",
    website: "https://blackforestlabs.ai",
    github: "black-forest-labs",
    tags: ["Image Generation", "Open Source"],
  },
  {
    name: "Civitai",
    website: "https://civitai.com",
    github: "civitai",
    tags: ["AI Models", "Community"],
  },
  {
    name: "Hedra",
    website: "https://hedra.com",
    github: "hedra-labs",
    tags: ["Video Generation"],
  },
  {
    name: "Replit",
    website: "https://replit.com",
    github: "replit",
    tags: ["IDE", "Coding"],
  },
];

interface GitHubRepoInfo {
  stargazers_count: number;
  description: string;
  html_url: string;
}

export class A16zPortfolioCollector implements FeedCollector {
  source = "a16z" as const;

  async fetchLatest(): Promise<ExternalFeedItem[]> {
    const items: ExternalFeedItem[] = [];

    for (const company of A16Z_AI_COMPANIES) {
      let stars: number | undefined;
      let ghDescription: string | undefined;

      if (company.github) {
        try {
          const repoInfo = await this.fetchTopRepo(company.github);
          if (repoInfo) {
            stars = repoInfo.stargazers_count;
            ghDescription = repoInfo.description;
          }
        } catch {
          // GitHub API failure doesn't block the main flow
        }
      }

      items.push(this.normalize(company, stars, ghDescription));
    }

    console.error(`[a16z] Fetched ${items.length} AI portfolio companies`);
    return items;
  }

  async save(): Promise<SaveResult> {
    const items = await this.fetchLatest();
    return saveItems("a16z", items, "portfolio");
  }

  private async fetchTopRepo(
    org: string,
  ): Promise<GitHubRepoInfo | null> {
    try {
      const repos = await fetchJson<GitHubRepoInfo[]>(
        `https://api.github.com/orgs/${org}/repos?sort=stars&per_page=1`,
        {
          headers: { Accept: "application/vnd.github+json" },
          retries: 2,
        },
      );
      return repos[0] || null;
    } catch {
      return null;
    }
  }

  private normalize(
    company: CompanyEntry,
    stars?: number,
    ghDescription?: string,
  ): ExternalFeedItem {
    return {
      id: `a16z-${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      source: "a16z",
      title: company.name,
      tagline: ghDescription || company.description || "",
      description: "",
      url: "https://a16z.com/portfolio/",
      externalUrl: company.website,
      imageUrl: null,
      categories: company.tags,
      metrics: { stars },
      metadata: {
        investor: "a16z",
        github: company.github,
        tags: company.tags,
      },
      fetchedAt: new Date().toISOString(),
      publishedAt: null,
    };
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /a16z-portfolio\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const args = process.argv.slice(2);
  const save = args.includes("--save");

  const collector = new A16zPortfolioCollector();
  if (save) {
    collector
      .save()
      .then((r) =>
        console.log(`Saved ${r.count} items to ${r.outDir} (${r.bytes} bytes)`),
      )
      .catch(console.error);
  } else {
    collector
      .fetchLatest()
      .then((items) => console.log(JSON.stringify(items, null, 2)))
      .catch(console.error);
  }
}
