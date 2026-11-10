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

- 做了什么：
- 完成的功能：
- 验证证明：
