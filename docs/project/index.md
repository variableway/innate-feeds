# Innate Feeds

**Status:** active  
**Updated:** 2026-07-06

## Agent 入口（每次会话先读）

1. 本文件 → 当前焦点与链接  
2. [`issues/`](./issues/README.md) 中 **Assignee** 或状态为 open/in_progress 的条目  
3. 对应 [`tasks/issues/`](./tasks/issues/) 日志**最后一条**

## 快速导航

| 文档 | 说明 |
|---|---|
| [overview.md](./overview.md) | 全景、约束、Agent 分工 |
| [spec/README.md](./spec/README.md) | PRD、双模式、验收 |
| [spec/conventions.md](./spec/conventions.md) | 代码规范 |
| [spec/architecture.md](./spec/architecture.md) | 架构要点 |
| [spec/contracts/](./spec/contracts/README.md) | 跨模块接口约定 |
| [features/](./features/README.md) | 功能模块 |
| [issues/](./issues/README.md) | 任务契约 |
| [tasks/](./tasks/README.md) | 多 Agent 工作流 |
| [backlogs/](../backlogs/README.md) | 未立项的调研方案（可考虑，尚未决定）——含 [topic-curation-refactor](../backlogs/topic-curation-refactor.md)（分 Topic 精选重构方向）与 [topic-platform-redesign](../backlogs/topic-platform-redesign.md)（重构总案：架构/目录/UI/任务） |
| [arch-design/architecture.html](../arch-design/architecture.html) | 总体框架与模块交互图 |
| [arch-design/edu-animate-domain.md](../arch-design/edu-animate-domain.md) | 教育动画垂直聚合域（edu-animate）的已采纳设计 |
| [research/arch-diagram-skill-eval.md](../research/arch-diagram-skill-eval.md) | arch-diagram skill 的对照评测结论 |
| [research/edu-animation-sources.md](../research/edu-animation-sources.md) | 教育动画 SKILL / 视频的端点与配额实测 |
| [research/eduos-github-radar-analysis.md](../research/eduos-github-radar-analysis.md) | EduOS GitHub Radar 源码分析（元数据目录治理：ETag / provenance / 白名单发布闸） |
| [research/aihot-analysis.md](../research/aihot-analysis.md) | AIHOT 源码分析（LLM 编辑部：双评分 / 聚簇热度 / MCP 出口范本） |
| [research/open-apps-analysis.md](../research/open-apps-analysis.md) | Open Apps 源码分析（目录工业化：PR 化回写 / bot 预评审 / 常驻 issue / health 计算） |

## 仓库内 Skill

放在 `.claude/skills/`，随仓库入库，Agent 直接可加载。

| Skill | 用途 |
|---|---|
| [`feeds-sprint/`](../../.claude/skills/feeds-sprint/SKILL.md) | 按 `tasks/sprint-N/` 的文档驱动工作流认领与回写任务 |
| [`arch-diagram/`](../../.claude/skills/arch-diagram/SKILL.md) | 产出有事实依据的仓库架构图：事实清点 → 选渲染器 → 截图验证 → 落库 |
| [`skill-eval/`](../../.claude/skills/skill-eval/SKILL.md) | 用「有 skill / 无 skill」两组对照评测一个 skill 是否真的更好 |

## 当前焦点

**Epic sheet-display（admin-data-sheet）已于 2026-11-07 归档**（cancelled）：Univer 方案被已上线的 CodeMirror admin 工作台取代，5 份 issue 与任务日志移至 [archive/issues](../archive/issues/)、[archive/tasks](../archive/tasks/)。当前进行中的方向见 [backlogs/topic-platform-redesign](../backlogs/topic-platform-redesign.md)（M0 目录重构已执行）。

- [ ] 确认 GitHub Pages 线上 URL，写入 [overview.md](./overview.md)

## 代码

| | 链接 |
|---|---|
| 仓库根目录 | [`/`](../)（本仓库） |
| GitHub | https://github.com/variableway/innate-feeds |

`innate-works` registry：`projects/innate-feeds/index.md`

## 仓库根配置

薄层 [`AGENTS.md`](../../AGENTS.md) / `CLAUDE.md` 指向本目录；项目事实不在根配置重复。
