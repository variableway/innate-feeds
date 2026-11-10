# task-02：shared 分类表契约 + 采集清单扩充 + 实跑同步

- 依赖：task-01（消费 research 的推荐清单）
- Issue：[#68](https://github.com/variableway/innate-feeds/issues/68)

## 计划（开工前）

- 做什么：把 task-01 定稿的分类表落成跨层常量契约，并把新 topic 并入采集清单实跑同步
  落盘，让查询面有数据可查。
- 功能点：
  ① `shared/` 新增分类表常量（建议 `shared/topic-query-groups.ts`，命名以 task-01 契约
    草案为准）：EDU 3 组 + 产品开发 5 步，每组 `{ id, label, labelZh, kind: "category" |
    "step", parent?, topics[] }`；纯常量/纯函数，无 IO，不 import backend/frontend——
    遵守 AGENTS.md 的 shared/ 边界；
  ② `backend/src/collectors/core/github-topics.ts`：新 topic 并入分组清单
    （`TOPIC_CATEGORIES` 或按新契约重构），进 `DEFAULT_TOPICS` 使 `sync github-topics`
    默认覆盖；
  ③ 实跑 `bun src/app/cli.ts sync github-topics --topic …` 全部新 topic，落
    `~/.innate/github-topics/topics/{topic}.json`；产品开发第 5 步不重复同步
    `UX_DESIGN_TOPICS` 已有 14 个 topic，只补新增分析类候选；
  ④ 跑 `data:export` / topics 导出链路确认静态快照包含新 topic。
- 如何验证：`sync github-topics` 输出新 topic 各 count≈50 的落盘统计（new/existing 有数）；
  `GET /api/topics` 索引含全部新 topic；`frontend/public/data/topics/` 含对应 json；
  `bun run typecheck` 绿；backend `bun test` 绿（如有常量单测则附）。

## 完成回填（完成后）

- 做了什么：
- 完成的功能：
- 验证证明：
