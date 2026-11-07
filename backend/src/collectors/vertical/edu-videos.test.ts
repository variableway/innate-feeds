import { describe, expect, test } from "bun:test";
import {
  parseDuration,
  parseRssFeed,
  toFeedItem,
  type EduVideoFeed,
} from "./edu-videos.js";
import {
  matchEduCategories,
  isEduDomain,
} from "../../../../shared/edu-categories.js";

const feed: EduVideoFeed = {
  id: "3b1b",
  title: "3Blue1Brown",
  handle: "@3blue1brown",
  category: "explainer",
  note: "数学可视化动画的标杆",
};

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123</yt:videoId>
    <yt:channelId>UCsBjURrPoezykLs9EqgamOA</yt:channelId>
    <title>But what is a convolution?</title>
    <author><name>3Blue1Brown</name><uri>https://www.youtube.com/@3blue1brown</uri></author>
    <published>2026-10-20T12:00:00+00:00</published>
    <media:group><media:description>A visual explainer on convolutions &amp; why they matter.</media:description></media:group>
  </entry>
  <entry>
    <id>yt:video:def456</id>
    <yt:videoId>def456</yt:videoId>
    <title>Why do prime numbers exist?</title>
    <author><name>3Blue1Brown</name></author>
    <published>2026-10-18T12:00:00+00:00</published>
  </entry>
</feed>`;

describe("edu-videos 解析", () => {
  test("解析 ISO 8601 时长", () => {
    expect(parseDuration("PT4M13S")).toBe(253);
    expect(parseDuration("PT1H2M3S")).toBe(3723);
    expect(parseDuration("PT30S")).toBe(30);
    expect(parseDuration(undefined)).toBeNull();
    expect(parseDuration("not-a-duration")).toBeNull();
  });

  test("解析频道 RSS", () => {
    const entries = parseRssFeed(RSS);
    expect(entries.length).toBe(2);
    expect(entries[0].videoId).toBe("abc123");
    expect(entries[0].title).toBe("But what is a convolution?");
    expect(entries[0].channelTitle).toBe("3Blue1Brown");
    expect(entries[0].publishedAt).toBe("2026-10-20T12:00:00.000Z");
    // XML 实体要还原
    expect(entries[0].description).toContain("convolutions & why");
  });

  test("缺少 videoId 的条目被跳过", () => {
    const broken = `<feed><entry><title>no id</title></entry></feed>`;
    expect(parseRssFeed(broken).length).toBe(0);
  });

  test("映射为 ExternalFeedItem：id 唯一、URL 可点、分类含策展分类", () => {
    const item = toFeedItem(
      {
        videoId: "abc123",
        title: "But what is a convolution?",
        description: "A visual explainer on convolutions.",
        channelTitle: "3Blue1Brown",
        publishedAt: "2026-10-20T12:00:00.000Z",
        duration: 253,
        views: 1234567,
        likes: 89000,
      },
      feed,
    );
    expect(item.id).toBe("edu-videos-abc123");
    expect(item.source).toBe("edu-videos");
    expect(item.url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(item.imageUrl).toContain("abc123");
    // 策展分类必须在，关键词分类可叠加
    expect(item.categories).toContain("explainer");
    expect(item.metrics.score).toBe(1234567);
    expect(item.metadata.feedId).toBe("3b1b");
    expect(item.publishedAt).toBe("2026-10-20T12:00:00.000Z");
  });

  test("无播放量时 metrics 为空而非 0", () => {
    const item = toFeedItem(
      {
        videoId: "x",
        title: "t",
        description: "",
        channelTitle: "c",
        publishedAt: null,
        duration: null,
        views: null,
        likes: null,
      },
      feed,
    );
    expect(item.metrics.score).toBeUndefined();
    expect(item.publishedAt).toBeNull();
  });
});

describe("教育动画分类表", () => {
  test("按关键词归类，且通用词不压过专用词", () => {
    // 'remotion' 命中 animation-tools；文本里没有 'video'，不该命中 video-production
    expect(matchEduCategories("remotion-best-practices animation")).toEqual([
      "animation-tools",
    ]);
    // 多个维度同时命中时按 EDU_CATEGORIES 的顺序返回
    const hits = matchEduCategories("remotion animated-video subtitle");
    expect(hits).toContain("animation-tools");
    expect(hits).toContain("explainer");
    expect(hits).toContain("video-production");
    expect(hits.indexOf("animation-tools")).toBeLessThan(
      hits.indexOf("explainer"),
    );
  });

  test("领域判定：教育/动画命中，纯工程词不命中", () => {
    expect(isEduDomain("remotion-best-practices")).toBe(true);
    expect(isEduDomain("storyboard-creation")).toBe(true);
    expect(isEduDomain("kubernetes-operator")).toBe(false);
    expect(isEduDomain("postgres-migration")).toBe(false);
  });
});
