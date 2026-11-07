import { describe, it, expect } from "vitest";
import { normalizeHNHit } from "./hackernews.js";
import { normalizeDevToArticle } from "./devto.js";
import { normalizeLobster } from "./lobsters.js";
import { normalizeHFEntry } from "./huggingface.js";
import { normalizeNewRepo } from "./github-new.js";

describe("normalizeHNHit", () => {
  it("maps an Algolia front-page hit", () => {
    const item = normalizeHNHit({
      objectID: "50300683",
      title: "Show HN: Bun 1.3",
      url: "https://bun.sh",
      author: "jarredsumner",
      points: 857,
      num_comments: 512,
      created_at: "2026-10-30T07:09:12Z",
    });
    expect(item.id).toBe("hackernews-50300683");
    expect(item.source).toBe("hackernews");
    expect(item.url).toBe("https://news.ycombinator.com/item?id=50300683");
    expect(item.externalUrl).toBe("https://bun.sh");
    expect(item.metrics.score).toBe(857);
    expect(item.metrics.comments).toBe(512);
    expect(item.publishedAt).toBe("2026-10-30T07:09:12Z");
  });

  it("strips escaped HTML in story_text to a tagline", () => {
    const item = normalizeHNHit({
      objectID: "1",
      title: "Ask HN",
      url: null,
      author: "a",
      points: 1,
      num_comments: 0,
      created_at: null,
      story_text: "<p>Hello &#x2F; world &amp; more</p>",
    });
    expect(item.tagline).toBe("Hello / world & more");
    expect(item.externalUrl).toBeNull();
  });
});

describe("normalizeDevToArticle", () => {
  it("maps reactions/comments and tags", () => {
    const item = normalizeDevToArticle({
      id: 4766389,
      title: "What was your win this week?",
      description: "Looking back on your week",
      url: "https://dev.to/devteam/win",
      cover_image: null,
      positive_reactions_count: 120,
      comments_count: 34,
      published_at: "2026-10-30T00:00:00Z",
      reading_time_minutes: 1,
      tag_list: ["discuss", "watercooler"],
      user: { username: "devteam", name: "Dev Team" },
    });
    expect(item.id).toBe("devto-4766389");
    expect(item.metrics.score).toBe(120);
    expect(item.metrics.comments).toBe(34);
    expect(item.categories).toEqual(["discuss", "watercooler"]);
    expect(item.metadata.author).toBe("devteam");
  });
});

describe("normalizeLobster", () => {
  it("maps score/comments/tags and points url at the local thread", () => {
    const item = normalizeLobster({
      short_id: "ttp7aq",
      title: "Backdoors in Claude Code extensions",
      url: "https://example.com/post",
      score: 149,
      comment_count: 38,
      created_at: "2026-10-30T06:04:55.168-05:00",
      description: null,
      tags: ["security"],
      submitter_user: { username: "dsr" },
    });
    expect(item.id).toBe("lobsters-ttp7aq");
    expect(item.url).toBe("https://lobste.rs/s/ttp7aq");
    expect(item.externalUrl).toBe("https://example.com/post");
    expect(item.metrics.score).toBe(149);
    expect(item.categories).toEqual(["security"]);
    expect(item.metadata.submitter).toBe("dsr");
  });
});

describe("normalizeHFEntry", () => {
  it("maps a trending repo entry (model)", () => {
    const item = normalizeHFEntry({
      id: "meta-llama/Llama-3.3-70B",
      repoType: "model",
      createdAt: "2026-10-29T00:00:00Z",
      repoData: {
        id: "meta-llama/Llama-3.3-70B",
        likes: 4321,
        downloads: 2_000_000,
        pipeline_tag: "text-generation",
        author: "meta-llama",
      },
    });
    expect(item).not.toBeNull();
    expect(item!.source).toBe("huggingface");
    expect(item!.url).toBe("https://huggingface.co/meta-llama/Llama-3.3-70B");
    expect(item!.metrics.score).toBe(4321);
    expect(item!.metrics.downloads).toBe(2_000_000);
    expect(item!.tagline).toBe("text-generation");
  });

  it("uses the datasets prefix for dataset repoType", () => {
    const item = normalizeHFEntry({
      id: "openai/gsm8k",
      repoType: "dataset",
      repoData: { likes: 12 },
    });
    expect(item!.url).toBe("https://huggingface.co/datasets/openai/gsm8k");
    expect(item!.categories).toContain("dataset");
  });

  it("returns null without an id", () => {
    expect(normalizeHFEntry({ repoType: "model", repoData: {} })).toBeNull();
  });
});

describe("normalizeNewRepo", () => {
  it("maps stars/forks and language as category", () => {
    const item = normalizeNewRepo(
      {
        id: 123456,
        full_name: "someone/fast-rag",
        html_url: "https://github.com/someone/fast-rag",
        description: "Fast RAG engine",
        stargazers_count: 175,
        forks_count: 9,
        language: "Rust",
        created_at: "2026-10-28T00:00:00Z",
        updated_at: "2026-10-30T00:00:00Z",
        topics: ["rag", "llm"],
        owner: {
          login: "someone",
          avatar_url: "https://avatars.example.com/u/1",
        },
      },
      "new-2026-10-24",
    );
    expect(item.id).toBe("github-new-123456");
    expect(item.title).toBe("someone/fast-rag");
    expect(item.metrics.stars).toBe(175);
    expect(item.metrics.forks).toBe(9);
    expect(item.categories).toEqual(["Rust", "rag", "llm"]);
    expect(item.publishedAt).toBe("2026-10-28T00:00:00Z");
  });
});
