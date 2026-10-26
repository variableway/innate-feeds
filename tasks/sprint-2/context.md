# Sprint-2：DSH 插件目录域化拆分（datasource 抽离）

**来源 Issue:** https://github.com/variableway/innate-feeds/issues/13
**状态:** in_progress
**开始:** 2026-10-26
**状态总表:** [`status.md`](./status.md)（任何 Agent 完成任务后必须更新）

## Sprint 目标

把 DSH 插件目录从 feeds 域中拆出，转成 innate-fe-cli 域插件模式，并把 datasource 部分抽离：

1. **T1 datasource 抽离**：dsh 目录加载/搜索/API 路由/静态导出从 feeds 后端文件中切出，收敛到 `backend/src/dsh/` 模块树（行为零变化）。
2. **T2 新建 `@innate/domain-dsh`**：顶层 `dsh/` 目录，自包含域插件包（迁移 UI + vendor 共用小组件），满足 `scanDomains` 契约。
3. **T3 feeds 域瘦身 + 宿主双域组合**：frontend 删除 /dsh；standalone 宿主（main.tsx/HostShell，host-only）组合 feeds + dsh 两个 domain，单站导航体验不变。
4. **T4 清理收口**：删除死代码 `dsh-plugin-directory/`；CI / 文档 / 部署验证。

## 任务拆分与依赖

| Task | 文档 | GitHub Issue | 依赖 | 说明 |
|---|---|---|---|---|
| R1 可行性与方案调研 | [research/dsh-domain-split.md](./research/dsh-domain-split.md) | #13 内 | 无 | **已完成**（结论：可行） |
| T1 dsh datasource 抽离（backend） | [task-01-datasource.md](./task-01-datasource.md) | #18 | R1 | 纯迁移，API 契约不变 |
| T2 新建 @innate/domain-dsh 包 | [task-02-domain-package.md](./task-02-domain-package.md) | #19 | T1（共用 plugin-catalog 迁移面） | 新增包，不动 frontend —— 落地后仓库短期双份 /dsh（可接受，保证每步全绿） |
| T3 feeds 域瘦身 + 宿主双域组合 | [task-03-slim-and-host.md](./task-03-slim-and-host.md) | #20 | T2 | 删 frontend 内 dsh + main.tsx/HostShell 双域 |
| T4 死代码清理与 CI/文档收口 | [task-04-cleanup.md](./task-04-cleanup.md) | #21 | T3 | 删 Next.js 原型、CI typecheck、AGENTS.md/docs、Pages 验证 |

**顺序执行**（T1→T4 每步仓库可构建、CI 绿）；所有新增 Issue 打 label `feeds-sprint-2`。

## 工作流约定

同 [sprint-1 工作流](../sprint-1/context.md)（认领改 status.md → 执行 → 回填验收 → done+SHA → 关 issue → 执行日志追加）。

## 相关背景

- 方案全文：[`research/dsh-domain-split.md`](./research/dsh-domain-split.md)（契约核对、8 项关键决策、风险表）
- 前置迁移：[docs/arch-design/innate-fe-plugin-migration.md](../../docs/arch-design/innate-fe-plugin-migration.md)（feeds 域的插件化，§6-4 即本 sprint 的伏笔）
- 基础仓位置：`~/.innate-fe-cli.json` → `~/orca/workspaces/innate-fe/github-pages-website`
