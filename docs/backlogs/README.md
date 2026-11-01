# Backlogs

调研完成、**尚未决定是否实施**的方案在此归档。与 [`docs/project/issues/`](../project/issues/) 的区别：

| | `docs/project/issues/` | `docs/backlogs/` |
|---|---|---|
| 状态 | 已立项、待实施或进行中 | **未立项**，只有分析与方案 |
| 契约 | 有验收标准、有 assignee、有 task 日志 | 无 assignee、无验收标准 |
| 流转 | 立项时迁入 `issues/`，并登记 GitHub Issue | 需要时再开 GitHub Issue 并迁入 `issues/` |

`docs/arch-design/` 放**已采纳**的设计文档；本目录放**候选**方案。

| ID | 标题 | 状态 | GitHub Issue | 调研日期 |
|---|---|---|---|---|
| [newsnow-trendradar-integration](./newsnow-trendradar-integration.md) | 接入中文热榜源（newsnow / TrendRadar / NewsNext） | backlog · 待决策 | [#36](https://github.com/variableway/innate-feeds/issues/36) | 2026-11-01 |
| [frontend-backend-data-separation](./frontend-backend-data-separation.md) | 前后端数据分离的代码结构调整计划 | backlog · 待决策 | [#36](https://github.com/variableway/innate-feeds/issues/36) | 2026-11-01 |

**Status:** `backlog`（默认） · `decided`（已决策，转入 issues/ 或放弃）

参考仓库按本仓约定登记在 [`registry.yaml`](../../registry.yaml)——本仓不纳入外部源码，只记录「引用过哪个仓库、锚定哪个提交、用来做什么」。

---

## 归档条目的最低要求

1. **结论先行**：开头给出「接什么 / 不接什么」的一句话判断，避免读者自己从长文里挖。
2. **证据可复核**：关键结论标注文件路径 + 行号，指向 `registry.yaml` 登记的 `repo@commit`。
3. **许可红线单列**：明确写出「能抄什么 / 不能抄什么」，避免后来者误引入 GPL/AGPL 代码。
4. **可达性标注实测来源**：区分「实测」与「推断」，后者必须写明推断依据。
5. **待决策项成文**：把需要人拍板的问题列成清单，而不是埋在正文里。
