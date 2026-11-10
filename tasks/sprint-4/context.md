# Sprint 4 — 增加 Topic 查询（分类 + 步骤）· context

## 背景

来源：[issue #68](https://github.com/variableway/innate-feeds/issues/68)「增加Topic查询」。
需求原文要点：Topic 资料查询按照**分类和步骤**分——

1. EDU 部分分为 interactive edu、teachable edu、edu animation tutorial；
2. 增加产品开发的 topic，分成 5 步：
   1. brainstorm
   2. 需求分析和编写
   3. 需求任务分解和开发任务编写
   4. 实现计划、Spec、实现任务、验证测试、handoff
   5. UI/UX 设计、分析、优化、Anti-Slot

口径约定：

- 「Anti-Slot」按 **Anti-Slop**（反 AI 味）理解——仓库已有 anti-slop / slop / ai-slop /
  humanizer topic 生态（sprint-3 B17–B19，`UX_DESIGN_TOPICS`），产品开发第 5 步直接复用并扩展。
- 「Topic 资料查询」指 GH #24 的 GitHub Topics 数据源查询面（`/api/topics*`、
  `/topics`、`/topics/:topic`），不是 GitHub Search 临时查询。
- 现状差距：`/topics` 是平铺 topic 索引；EDU 侧现有分类（`shared/edu-categories.ts`
  8 类动画制作向）与 issue 要的三分组不同维；产品开发 5 步完全没有 topic 池。

## 目标

Topic 查询面按「分类（EDU / 产品开发）→ 步骤/子类」两级组织：

- EDU：interactive edu / teachable edu / edu animation tutorial 三组，各有实证过的 topic 池；
- 产品开发：brainstorm → 需求分析和编写 → 任务分解与开发任务编写 → 实现计划·Spec·验证测试·handoff
  → UI/UX 设计·分析·优化·Anti-Slop 五步，各有实证过的 topic 池（第 5 步复用 UX_DESIGN_TOPICS）；
- `/topics` 查询面按上述两级分组浏览与深链；静态模式同步可用。

## 任务索引

| Task | 内容 | 依赖 | 状态 |
|---|---|---|---|
| task-01 | 分类表设计 + topic 种子实证（research） | — | todo |
| task-02 | shared 分类表契约 + 采集清单扩充 + 实跑同步 | task-01 | todo |
| task-03 | EDU 三分组归类与查询支持 | task-01 | todo |
| task-04 | `/topics` 分类+步骤两级查询 UI + 静态验证 | task-02、task-03 | todo |

依赖图：task-01 → (task-02, task-03) → task-04。
task-02 / task-03 互不依赖，可并行。

## 工作流约定（feeds-sprint）

1. 认领前读 `status.md`：`done` 跳过；`in_progress` 且非本人不碰；`blocked` 看备注。
2. 认领 = `status.md` 置 `in_progress` + Agent 名；完成 = 置 `done` + 提交 SHA + 回填 task 文档。
3. 全部任务归 [issue #68](https://github.com/variableway/innate-feeds/issues/68)（拆解执行，
   不另开子 issue；全部 done 后 `gh issue close 68`）。
4. 提交：conventional commits（`feat:` / `docs:` / `chore:`），分支 `qdriven/topic`。
5. 验证基线：`bun run typecheck`（backend/frontend/域包）+ `bun test`（backend）；
   涉及前端的加页面 200 / dump-dom 或 `VITE_STATIC_MODE` 构建验证（参考 sprint-3 回填风格）。
