import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  getConfiguredTopics,
  syncTopics,
  TOPIC_LIMIT,
} from "./github-topics.js";
import {
  buildTopicResponse,
  buildTopicsIndex,
  readTopicSnapshot,
  saveTopicSnapshot,
  slugifyTopic,
  addUserTopic,
  readUserTopics,
  type TopicSnapshotItem,
} from "../data/topics-store.js";
import type { ExternalFeedItem } from "./shared/types.js";

function repo(id: number, fullName: string, stars = 10): ExternalFeedItem {
  const [owner, name] = fullName.split("/");
  return {
    id: `gh-topic-${id}`,
    source: "github-topics",
    title: name,
    tagline: `${fullName} description`,
    description: "",
    url: `https://github.com/${fullName}`,
    externalUrl: null,
    imageUrl: `https://avatars.example/${owner}`,
    categories: ["edtech"],
    metrics: { stars },
    metadata: {
      githubRepoId: id,
      fullName,
      owner,
      ownerLogin: owner,
      ownerAvatarUrl: `https://avatars.example/${owner}`,
      ownerUrl: `https://github.com/${owner}`,
      language: "TypeScript",
      forks: 1,
      watchers: 2,
      searchedTopic: "edtech",
      topics: ["edtech"],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    },
    fetchedAt: "2026-10-28T00:00:00Z",
    publishedAt: null,
  };
}

let home: string;
const originalHome = process.env.INNATE_HOME;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "innate-topics-"));
  process.env.INNATE_HOME = home;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.INNATE_HOME;
  else process.env.INNATE_HOME = originalHome;
  rmSync(home, { recursive: true, force: true });
});

describe("syncTopics", () => {
  test("keeps every fetched repo but only reports new ones", async () => {
    const items = [repo(1, "a/one"), repo(2, "b/two"), repo(3, "c/three")];

    const [result] = await syncTopics({
      topics: ["edtech"],
      existingFullNames: ["B/TWO"],
      fetchTopic: async () => items,
    });

    // b/two already exists in the feeds → not a new discovery.
    expect(result.count).toBe(3);
    expect(result.newCount).toBe(2);
    expect(result.skippedExisting).toBe(1);

    // …but it is still stored, so opening the topic shows the full list.
    const snapshot = readTopicSnapshot("edtech");
    expect(snapshot?.items.length).toBe(3);
    expect(
      snapshot?.items.map(
        (i) => (i.metadata as Record<string, unknown>).fullName,
      ),
    ).toEqual(["a/one", "b/two", "c/three"]);
    expect(
      (snapshot?.items[1].metadata as Record<string, unknown>).existingInFeeds,
    ).toBe(true);
  });

  test("re-sync does not report already seen repos as new", async () => {
    const items = [repo(1, "a/one"), repo(2, "b/two")];

    const first = await syncTopics({
      topics: ["edtech"],
      fetchTopic: async () => items,
    });
    expect(first[0].newCount).toBe(2);
    expect(first[0].skippedSeen).toBe(0);

    const second = await syncTopics({
      topics: ["edtech"],
      fetchTopic: async () => items,
    });
    expect(second[0].newCount).toBe(0);
    expect(second[0].skippedSeen).toBe(2);

    // The first-seen timestamp is preserved across syncs.
    const snapshot = readTopicSnapshot("edtech");
    expect(snapshot?.items[0].firstSeenAt).toBe(first[0].fetchedAt);
  });

  test("defaults to the top 50 limit", () => {
    expect(TOPIC_LIMIT).toBe(50);
  });
});

describe("topics store", () => {
  test("round-trips a snapshot and reports new/existing flags", () => {
    const fetchedAt = "2026-10-28T00:00:00.000Z";
    const items: TopicSnapshotItem[] = [
      { ...repo(1, "a/one"), firstSeenAt: fetchedAt },
      { ...repo(2, "b/two"), firstSeenAt: "2026-10-20T00:00:00.000Z" },
    ];
    saveTopicSnapshot("edtech", items, fetchedAt);

    const payload = buildTopicResponse("edtech", new Set(["b/two"]));
    expect(payload).not.toBeNull();
    expect(payload?.count).toBe(2);
    // Only the repo first seen in this snapshot counts as new.
    expect(payload?.newCount).toBe(1);
    expect(payload?.existingCount).toBe(1);
    expect(payload?.items[0].isNew).toBe(true);
    expect(payload?.items[0].existing).toBe(false);
    expect(payload?.items[1].isNew).toBe(false);
    expect(payload?.items[1].existing).toBe(true);
    expect(payload?.items[0].fullName).toBe("a/one");
    expect(payload?.items[0].owner.login).toBe("a");
  });

  test("index lists the synced topics with counts", () => {
    const fetchedAt = "2026-10-28T00:00:00.000Z";
    saveTopicSnapshot(
      "edtech",
      [{ ...repo(1, "a/one"), firstSeenAt: fetchedAt }],
      fetchedAt,
    );
    saveTopicSnapshot(
      "llm",
      [{ ...repo(2, "b/two"), firstSeenAt: "2026-10-01T00:00:00.000Z" }],
      fetchedAt,
    );

    const index = buildTopicsIndex(new Set());
    expect(index.topics.map((t) => t.topic)).toEqual(["edtech", "llm"]);
    expect(index.topics[0].newCount).toBe(1);
    // "llm" was seen in an earlier sync → no new discovery.
    expect(index.topics[1].newCount).toBe(0);
  });

  test("slugifies topic names for file names", () => {
    expect(slugifyTopic("edtech")).toBe("edtech");
    expect(slugifyTopic("AI Agents")).toBe("ai-agents");
    expect(slugifyTopic("../escape")).toBe("escape");
  });
});

describe("user topics", () => {
  test("adds, dedupes, slugs, and persists configured topics", () => {
    expect(readUserTopics()).toEqual([]);
    expect(addUserTopic("AI Agents")).toEqual(["ai-agents"]);
    expect(addUserTopic("  AI Agents  ")).toEqual(["ai-agents"]);
    expect(readUserTopics()).toEqual(["ai-agents"]);
    expect(getConfiguredTopics()).toContain("ai-agents");
  });

  test("syncs user topics with the same first-seen rules", async () => {
    addUserTopic("rust-tools");
    const [result] = await syncTopics({
      topics: ["rust-tools"],
      fetchTopic: async () => [repo(1, "d/rust-tool")],
    });
    expect(result.topic).toBe("rust-tools");
    expect(result.newCount).toBe(1);
  });
});
