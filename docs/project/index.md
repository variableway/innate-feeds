# Project — 事实来源索引

> 项目「现在是什么」的入口。历史调研见 [../research/](../research/README.md)（含
> [projects/](../research/projects/README.md) 后续计划），已完结 issue 只留 GitHub 记录。

## 目录

| 路径 | 内容 |
|---|---|
| [overview.md](./overview.md) | 项目现状一页纸（定位 / 架构 / 目录 / 里程碑） |
| [spec/](./spec/README.md) | 契约与约定：contracts/（feeds-api-v1、admin-tables-api-v1）+ conventions。*README 与 architecture.md 为 MVP 时代版本，v2 待随 M2 重写* |
| [features/](./features/README.md) | v2 待写（M2）；现状权威 = [AGENTS.md](../../../AGENTS.md) |
| [issues/](./issues/README.md) | 未完结任务契约（当前仅 GH #33 producthunt）；完结项以 GitHub Issues 为准 |

## 当前焦点（2026-11-07）

- **Topic 平台重构**（[research/projects/topic-platform-redesign](../research/projects/topic-platform-redesign.md)）：M0 目录重构已执行并合入 main；下一步 **M1 热度引擎**（curation/ + 三新表 + `sync hot` + `/api/hot`，≈2 天，零 LLM），观察两周后定 M2。
- 未完成项 issue：M2 Topic Hub [#64](https://github.com/variableway/innate-feeds/issues/64) · M3/M4 出口 [#65](https://github.com/variableway/innate-feeds/issues/65) · 数据分离 S2/S1 余项 [#66](https://github.com/variableway/innate-feeds/issues/66) · 文档 v2 / CI 补源 [#67](https://github.com/variableway/innate-feeds/issues/67)
- 数据分离 S1-S3（归一化/查询语义/hidden）待排期。
- GH #33 Product Hunt 0 条采集问题待修。

## 仓库级技能（.claude/skills/）

| 技能 | 用途 |
|---|---|
| [`feeds-sprint/`](../../../.claude/skills/feeds-sprint/SKILL.md) | Sprint 任务工作流（tasks/sprint-N 按需重建） |
| [`arch-diagram/`](../../../.claude/skills/arch-diagram/SKILL.md) | 产出有事实依据的仓库架构图 |
| [`skill-eval/`](../../../.claude/skills/skill-eval/SKILL.md) | 有/无 skill 对照评测 |
| [`topic-discovery/`](../../../.claude/skills/topic-discovery/SKILL.md) | topic 发现 / 相关性搜索 / trendshift 精选 |
