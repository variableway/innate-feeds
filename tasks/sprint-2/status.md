# Sprint-2 任务状态总表

> **单一事实来源**：任何 Agent 动手前先读本表；完成后必须回写。
> 状态取值：`todo` / `in_progress` / `done` / `blocked` / `skipped(原因)`。
> 详细验收标准见各 task 文档；调研产出在 [`research/`](./research/)。

| Task | 说明 | 依赖 | Issue | 状态 | Agent | 完成 SHA / 备注 |
|---|---|---|---|---|---|---|
| R1 | 可行性与方案调研 | 无 | #13（epic 内） | done | claude-code | research/dsh-domain-split.md；结论可行 |
| T1 | dsh datasource 抽离（backend/src/dsh/） | R1 | #18 | done | claude-code | API 对拍等价（2716 plugins）；41 测试通过 |
| T2 | 新建 @innate/domain-dsh 包（dsh/） | T1 | #19 | done | claude-code | 2a506c5；基础仓 scanDomains 实测通过 |
| T3 | feeds 域瘦身 + 宿主双域组合 | T2 | #20 | done | claude-code | e4de7ad + 3184f32；三包 typecheck/41 测试/build 全绿，双域路由运行时实测 |
| T4 | 死代码清理与 CI/文档收口 | T3 | #21 | in_progress | claude-code | |

## 执行日志（追加式，最新在上）

- 2026-10-26 claude-code：Sprint-2 建档（R1 完成：可行性确认 + 方案定稿，见 research/dsh-domain-split.md）；任务 Issue #18–#21 已建（label feeds-sprint-2）。
