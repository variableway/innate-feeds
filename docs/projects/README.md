# Projects — 后续要做

「反映后续要做」的方案与计划在此集中归档（原 `docs/backlogs/`，2026-11-07 更名）。
与 [`docs/project/issues/`](../project/issues/) 的区别：

| | `docs/project/issues/` | `docs/projects/` |
|---|---|---|
| 状态 | 已立项、待实施或进行中 | **未立项或已决策待执行**，只有分析与方案 |
| 契约 | 有验收标准、有 assignee、有 task 日志 | 无 assignee；验收标准随方案走 |
| 流转 | 立项时迁入 `issues/`，并登记 GitHub Issue | 需要时再开 GitHub Issue 并迁入 `issues/` |

`docs/arch-design/` 放**已采纳**的设计文档；本目录放**候选与未完成**的方案。

| ID | 标题 | 状态 | GitHub Issue | 调研日期 |
|---|---|---|---|---|
| [topic-platform-redesign](./topic-platform-redesign.md) | 重构总案：系统架构五层 / 模块设计 / 目录结构终态（topics/ 收编 dsh+edu）与迁移映射 / AIHot UI 布局参考 / M0-M4 任务分解 / docs 治理（66 份盘点） | **已决策 · M0 已执行**（2026-11-07），下一步 M1 热度引擎 | — | 2026-11-07 |
| [frontend-backend-data-separation](./frontend-backend-data-separation.md) | 前后端数据分离的代码结构调整计划 | **进行中** · S0+S4 已落地（2026-11-07），S1-S3 留独立 track | [#36](https://github.com/variableway/innate-feeds/issues/36) | 2026-11-01 |
| [topic-curation-refactor](./topic-curation-refactor.md) | 分 Topic 的精选网站重构（AIHot 式编辑管线：热度引擎 + Topic Hub，后台宽进全收、前台严出精选） | backlog · 待决策（方向已并入总案） | — | 2026-11-07 |
| [newsnow-trendradar-integration](./newsnow-trendradar-integration.md) | 接入中文热榜源（newsnow / TrendRadar / NewsNext） | backlog · 待决策 | [#36](https://github.com/variableway/innate-feeds/issues/36) | 2026-11-01 |

**Status:** `backlog`（默认，待决策） · `decided`（已决策待执行） · `ongoing`（部分落地） · `archived`（完成或放弃，移 docs/archive/）
