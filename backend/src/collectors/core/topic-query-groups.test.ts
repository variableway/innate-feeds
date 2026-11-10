import { describe, expect, test } from "bun:test";
import {
  ALL_QUERY_TOPICS,
  EDU_CATEGORIES_BY_QUERY_GROUP,
  EDU_CATEGORY_QUERY_GROUP,
  QUERY_GROUP_BY_ID,
  QUERY_GROUP_OF_TOPIC,
  TOPIC_QUERY_CATEGORIES,
  eduQueryGroupOf,
} from "../../../../shared/topic-query-groups.js";
import { EDU_CATEGORIES } from "../../../../shared/edu-categories.js";
import { DEFAULT_TOPICS } from "./github-topics.js";

describe("topic query taxonomy (issue #68)", () => {
  test("每个 topic 只归一个分组，无跨组重复", () => {
    const seen = new Set<string>();
    for (const cat of TOPIC_QUERY_CATEGORIES) {
      for (const group of cat.groups) {
        for (const topic of group.topics) {
          expect(seen.has(topic)).toBe(false);
          seen.add(topic);
          expect(QUERY_GROUP_OF_TOPIC[topic]).toBe(group.id);
          expect(QUERY_GROUP_BY_ID[group.id]).toBe(group);
        }
      }
    }
  });

  test("ALL_QUERY_TOPICS = 分组 topics 去重并集", () => {
    expect(new Set(ALL_QUERY_TOPICS).size).toBe(ALL_QUERY_TOPICS.length);
    const union = new Set(
      TOPIC_QUERY_CATEGORIES.flatMap((c) => c.groups.flatMap((g) => g.topics)),
    );
    expect(new Set(ALL_QUERY_TOPICS)).toEqual(union);
  });

  test("DEFAULT_TOPICS 覆盖全部查询 topic 且无重复", () => {
    expect(new Set(DEFAULT_TOPICS).size).toBe(DEFAULT_TOPICS.length);
    for (const topic of ALL_QUERY_TOPICS) {
      expect(DEFAULT_TOPICS).toContain(topic);
    }
  });

  test("EDU 映射恰好覆盖 EDU_CATEGORIES 8 类，目标组存在", () => {
    expect(Object.keys(EDU_CATEGORY_QUERY_GROUP).sort()).toEqual(
      EDU_CATEGORIES.map((c) => c.id).sort(),
    );
    for (const groupId of Object.values(EDU_CATEGORY_QUERY_GROUP)) {
      expect(QUERY_GROUP_BY_ID[groupId]).toBeDefined();
      expect(QUERY_GROUP_BY_ID[groupId].kind).toBe("category");
    }
  });

  test("EDU_CATEGORIES_BY_QUERY_GROUP 与映射互逆", () => {
    for (const [categoryId, groupId] of Object.entries(
      EDU_CATEGORY_QUERY_GROUP,
    )) {
      expect(eduQueryGroupOf(categoryId)).toBe(groupId);
      expect(EDU_CATEGORIES_BY_QUERY_GROUP[groupId]).toContain(categoryId);
    }
  });

  test("产品开发步骤序号 1-5 按流程序", () => {
    const dev = TOPIC_QUERY_CATEGORIES.find((c) => c.id === "dev");
    expect(dev).toBeDefined();
    const steps = dev!.groups.map((g) => g.step);
    expect(steps).toEqual([1, 2, 3, 4, 5]);
    for (const g of dev!.groups) expect(g.kind).toBe("step");
    for (const g of TOPIC_QUERY_CATEGORIES.find(
      (c) => c.id === "edu",
    )!.groups) {
      expect(g.kind).toBe("category");
      expect(g.step).toBeUndefined();
    }
  });
});
