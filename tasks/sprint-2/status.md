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
| T4 | 死代码清理与 CI/文档收口 | T3 | #21 | done | claude-code | 5277410；build:static+preview 验证通过 |

## 执行日志（追加式，最新在上）

- 2026-10-26：T2 复验收 + 清理重复单。#15 与 #19 同内容已关（复验全绿：`dsh` typecheck、scanDomains 实测 `{id:"dsh", pluginOrder:30, hasStyles:false}`、根 pnpm install 识别 workspace、frontend 共用组件原件保留）；随后关闭 #14（dup of #18）、#17（dup of #21），#16（dup of #20）关闭时已是 closed。Sprint-2 的 8 张任务单（#14–#21）现全部 closed，无遗留 OPEN。
- 2026-10-26 claude-code：PR #22 CI 首跑连续两次失败于「Verdaccio 120s 未就绪」（npx 冷下载超时，非本 sprint 改动所致）；fix：CI/deploy 前置 `npm install -g verdaccio`（e2cecb5）后 Test & Type Check + Build 双绿。
- 2026-10-26 claude-code：Sprint-2 全部任务（T1–T4）完成。5 个提交（4718d4b / 2a506c5 / e4de7ad / 3184f32 / 5277410），Issue #18 #19 #20 #21 关闭，PR 待合并（closes #13）。实施中发现的两个事实超出原方案：① tsc paths 全局性 → dsh 包内改全相对导入；② 宿主直接复用 @innate/web-domain 的 collectWebDomainRoutes/collectNavItems 多域 API。
- 2026-10-26 claude-code：Sprint-2 建档（R1 完成：可行性确认 + 方案定稿，见 research/dsh-domain-split.md）；任务 Issue #18–#21 已建（label feeds-sprint-2）。
