# task-03：EDU 三分组归类与查询支持

- 依赖：task-01（分组定义与 EDU topic 清单）
- Issue：[#68](https://github.com/variableway/innate-feeds/issues/68)

## 计划（开工前）

- 做什么：让 Topic 查询的 EDU 部分按 interactive edu / teachable edu / edu animation
  tutorial 三分组组织：定义三组与现有 EDU 数据面的归属规则，并给出查询支持
  （分组筛选/展示所需的数据加工）。
- 功能点：
  ① 三分组语义定稿（写入 task-01 research 或本 task 回填）：interactive edu =
    交互式学习工具/平台类；teachable edu = 课程·教案·授课材料类；edu animation tutorial =
    教学动画·教程类；
  ② 归属规则落地：EDU topic（task-01/02 的 topic 池）按三分组归属；现有
    `shared/edu-categories.ts` 8 类 → 三分组给出映射表（哪个类归 interactive /
    teachable / animation tutorial，允许映射到两组时显式标注）；
  ③ 与 `topics/edu-animate`（/edu 域）对齐检查：skills / videos 快照分类能否沿同一
    三分组展示——能则复用映射，不能则记录差异（不强制本轮改 /edu 域）；
  ④ 查询支持：为 task-04 的分组 UI 提供 EDU 侧分组数据（按三分组聚合 topic /
    归类结果），API 或前端纯函数形态均可，形态与 task-04 约定。
- 如何验证：映射表覆盖 `EDU_CATEGORIES` 全部 8 类无遗漏；每组至少 5 个 topic 有归属；
  分组数据可被消费方（task-04 或单测）直接按组取到；`bun run typecheck` 绿。

## 完成回填（完成后）

- 做了什么：`shared/topic-query-groups.ts` 落 EDU 三分组（edu-interactive /
  edu-teachable / edu-animation-tutorial，含各自实证 topic 池）+ `EDU_CATEGORY_QUERY_GROUP`
  映射（8 类全覆盖）+ `eduQueryGroupOf()` / `EDU_CATEGORIES_BY_QUERY_GROUP`（互逆索引，
  UI 展示用）；不变量测试 `backend/src/collectors/core/topic-query-groups.test.ts`。
  与 /edu 域对齐检查见下。
- 完成的功能：① 三分组语义定稿：interactive = 交互式学习工具/平台/自测（9 topic）、
  teachable = 课程/教案/授课材料（8 topic）、animation tutorial = 讲解/白板/数学动画
  教程（6 topic）② 归属规则：EDU 查询 topic 按三分组归属（分组 topics），
  `EDU_CATEGORIES` 8 类 → 3 组映射落地（classroom → edu-teachable，其余 7 类 →
  edu-animation-tutorial；interactive/teachable 的新 topic 超出原 8 类覆盖面，由
  分组 topics 直接承载）③ 与 `topics/edu-animate` 对齐检查：/edu 的筛选/归类走
  `matchEduCategories` 8 类（skills/videos 快照分类），本轮**不改 /edu 域**——
  8 类→3 组映射即对齐桥，/edu 后续可零成本挂三分组 tab ④ 查询支持：task-04 经
  `@/types/topics` re-export 直接消费 `TOPIC_QUERY_CATEGORIES`（edu 分类）+
  映射索引。
- 验证证明：`bun test` 6/6 新用例绿（映射恰好覆盖 EDU_CATEGORIES 8 类、互逆索引
  roundtrip、分组无跨组重复、步骤序 1-5）；backend/前端 typecheck 绿。
