# task-01：分类表设计 + topic 种子实证（research）

- 依赖：无（Sprint 4 入口任务）
- Issue：[#68](https://github.com/variableway/innate-feeds/issues/68)
- 产出物：`tasks/sprint-4/research/topic-query-taxonomy.md`

## 计划（开工前）

- 做什么：定稿「分类 + 步骤」两级 Topic 查询分类表，并为每个子类/步骤实证 GitHub topic
  种子（topic 是否存在、生态规模、与组内语义吻合），形成可直接落契约的推荐清单。
  方法复用 `.claude/skills/topic-discovery/`（starred 种子 lift 分层 + T1 共现 / T2 Jaccard
  相关性搜索），候选词先从 issue 原文语义发散，再用 GitHub topic 页/搜索 API 实证淘汰。
- 功能点：
  ① EDU 三分组定义（interactive edu / teachable edu / edu animation tutorial），
    每组给 5–10 个实证 topic（例：interactive → `interactive-tutorial` `edtech` `quiz`；
    teachable → `lesson-plan` `curriculum` `course`；animation tutorial → `manim` `remotion`
    `explainer-video`，需与现有 `shared/edu-categories.ts` 给出映射或并列关系说明）；
  ② 产品开发五步骤定义（brainstorm / 需求分析和编写 / 需求任务分解和开发任务编写 /
    实现计划·Spec·实现任务·验证测试·handoff / UI/UX 设计·分析·优化·Anti-Slop），
    每步给 5–10 个实证 topic（例：brainstorm → `brainstorm` `mind-map` `whiteboard`；
    需求 → `prd` `user-story` `requirements-management`；分解 → `task-management`
    `project-management`；实现·验证 → `tdd` `test-automation` `code-review`；
    UI/UX 步复用 `UX_DESIGN_TOPICS` 并补 `ux-research` `usability` 等分析类候选）；
  ③ 每个 topic 附实证记录（GitHub topic 页可达 + 大致 repo 量级 + 采纳/淘汰理由）；
  ④ 给出契约草案：分组 id/label/父子关系/topics 的结构建议（落 `shared/` 的形状由
    task-02 定稿，此处给推荐）。
- 如何验证：research 文档含全部 8 组的实证清单，候选淘汰有记录；组内 topic 无跨组重复
  归属冲突（或明确标注共享组）；分类表能被 task-02/03/04 直接消费无再讨论。

## 完成回填（完成后）

- 做了什么：GitHub Search API 逐个实证 64 个候选 topic（`topic:{name}` 的 total_count，
  2026-11-10 快照），按「量级 ≥50 + 语义吻合 + 近重复留大者」定稿 8 组分类表
  （EDU 3 组 + 产品开发 5 步），56 采纳 / 8 淘汰；给出 shared/ 契约草案与
  EDU_CATEGORIES 8 类 → 3 组映射预案。产出
  `tasks/sprint-4/research/topic-query-taxonomy.md`。
- 完成的功能：① EDU 三分组各 6–9 个实证 topic（interactive 9 / teachable 8 /
  animation-tutorial 6）② 产品开发五步各 5–9 个（brainstorm 7 / 需求 5 / 分解 7 /
  实现验证 9 / UI-UX 14 复用 + 5 新增）③ 口径定稿：Anti-Slot = Anti-Slop、
  teachable edu = 授课/课程型、Topic 资料查询 = GH #24 查询面 ④ 淘汰记录齐
  （spec-writing/work-breakdown 等 8 个，含理由）。
- 验证证明：全部候选的 total_count 实测记录在 research 文档表格（如
  spec-driven-development 2935、work-breakdown 0、educational-animation 5）；
  8 组 topic 无跨组重复；`edtech` 与 `EDTECH_TOPICS` 的去重规则已标注；
  契约草案可直接被 task-02/03/04 消费。
