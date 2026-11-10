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

- 做了什么：`shared/topic-query-groups.ts` 落契约（`TOPIC_QUERY_CATEGORIES` 8 组 /
  70 topic + `ALL_QUERY_TOPICS` / `QUERY_GROUP_BY_ID` / `QUERY_GROUP_OF_TOPIC` 索引）；
  `github-topics.ts` 的 `DEFAULT_TOPICS` 并入查询清单 Set 去重（90 个），并补 Search
  API 限速护栏（topic 间 2.2s 节流 + 失败退避 5s/15s 重试 2 轮——清单扩容后必需，
  认证 Search API 30 req/min）；`frontend/src/types/topics.ts` re-export 契约；
  实跑 `sync github-topics` 全量 90 topic 落盘；`exportTopicsStatic` 导出静态快照。
- 完成的功能：① 分类表契约跨层就绪（backend 同步清单 + 前端查询 UI 共用一份）
  ② 55 个新 topic 实跑入库（90 配置 = 20 AI + 1 edtech + 14 UX + 55 新；去重后
  DEFAULT_TOPICS 90 项无重复）③ 快照各 top 50（小生态全量：lesson-plan 45、
  whiteboard-animation 39）④ 静态导出 `frontend/public/data/topics/` 90 个
  topic json + index.json，existing 标记按 feeds.db 实解（如 prd 33 new / 17 in
  feeds、e2e-testing 44/6）⑤ 限速护栏让 90 topic 全量同步一次跑通（约 8 分钟，
  0 个限速失败）。
- 验证证明：`bun test` 123 pass / 0 fail（含新不变量测试 6 例：分组无跨组重复、
  DEFAULT_TOPICS 覆盖并集、EDU 映射全覆盖、步骤序 1-5）；backend/前端 typecheck 绿；
  导出目录 91 文件、index 90 项，抽查 prd/brainstorm/spec-driven-development/handoff/
  ux-audit/lesson-plan/manim 数据齐全。提交 **（见 status.md）**。
