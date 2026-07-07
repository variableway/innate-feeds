# Tasks: Innate Feeds

## 分工

| 文件 | 内容 |
|---|---|
| [`issues/<id>.md`](../issues/) | 任务契约（是什么、怎么验收） |
| [`tasks/issues/<id>.md`](./issues/) | 施工日志（怎么做的、交给谁） |

**Chat 是输入，issue 是契约，log 是交接凭证。**

## 多 Agent 工作流

```text
人：开 issue（含 Mode、Assignee、验收）
人：更新 innate-works registry next_action
人：向 Agent 发「四件套」prompt（见下）
Agent：独立分支 → 实现 → 追加 log → PR
人：换 Agent 时只发 issue id +「读 log 继续」
人：验收后改 issue status、features、overview 里程碑
```

## 四件套 Prompt（复制给任意 Agent）

```text
项目：innate-feeds
1. 读 docs/project/index.md
2. 读 docs/project/issues/<issue-id>.md
3. 读 docs/project/tasks/issues/<issue-id>.md（先看最后一条）
4. 本轮目标：（一句话 + 最多 3 条子任务）

分支：feature/<issue-id>-<agent>
做完：追加 task log；不要改 spec 非目标；不要建 .agents/
```

## 并行规则

- 禁止两 Agent 同时改**同一** issue  
- 禁止 Agent 并行改 spec  
- 不同 issue 可并行  

## 索引

| Issue | 过程记录 |
|---|---|
| [ui-layout](../issues/ui-layout.md) | [tasks/issues/ui-layout.md](./issues/ui-layout.md) |
| [sheet-display](../issues/sheet-display.md) | [tasks/issues/sheet-display.md](./issues/sheet-display.md)（epic） |
| [sheet-display-shell](../issues/sheet-display-shell.md) | [tasks/issues/sheet-display-shell.md](./issues/sheet-display-shell.md) |
| [sheet-display-api](../issues/sheet-display-api.md) | [tasks/issues/sheet-display-api.md](./issues/sheet-display-api.md) |
| [sheet-display-tables-panel](../issues/sheet-display-tables-panel.md) | [tasks/issues/sheet-display-tables-panel.md](./issues/sheet-display-tables-panel.md) |
| [sheet-display-univer](../issues/sheet-display-univer.md) | [tasks/issues/sheet-display-univer.md](./issues/sheet-display-univer.md) |

## admin-data-sheet 推荐交接顺序

```text
1. shell (claude-code)  ║  api (code-buddy)     ← 可并行
2. tables-panel (kimi)    ← 依赖 shell；api 可 mock
3. univer (trae)          ← 依赖 2 + api
```
