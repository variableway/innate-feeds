---
name: feeds-sprint
description: innate-feeds Sprint 工作流：按 tasks/sprint-N 的文档驱动方式认领、执行、回写任务状态。当用户要求"执行 sprint 任务"、"继续 sprint-1"、"按 feeds-sprint 工作流处理 issue"或创建/更新 sprint 任务时使用。
---

# feeds-sprint：文档驱动的多 Agent Sprint 工作流

本仓库用 `tasks/sprint-N/` 目录管理一个 Sprint。每个 Sprint 的执行原则：**先计划、任务独立、状态可查、可被任何 Agent 接手**。

## 目录结构（如何阅读）

```
tasks/sprint-N/
├── context.md        # Sprint 背景、目标、任务索引、依赖关系、工作流约定 —— 先读这个
├── status.md         # 任务状态总表（单一事实来源）：todo/in_progress/done/blocked
├── research/         # 调研产出物（方案对比、验证 SQL、推荐结论）
├── task-XX-*.md      # 每个独立任务一份文档：描述 + 依赖 + Issue 链接 + 验收记录
└── task-rX-*-research.md  # 调研类任务同样有 task 文档，产出物放 research/
```

阅读顺序：`context.md`（全局）→ `status.md`（找活）→ 对应 `task-XX.md`（怎么做、怎么算完成）。

## 执行规则

1. **认领前先查状态**：读 `status.md`，目标 task 已是 `done` → 直接跳到下一个无依赖或依赖已满足的 task；`in_progress` 且非本人 → 不要碰。
2. **认领**：把 `status.md` 对应行改为 `in_progress` + 写 Agent 名。
3. **执行**：实现改动进代码；调研产出写 `research/`；无论哪类，回填 task 文档的「验收记录」复选框。
4. **完成**：`status.md` 置 `done` + 提交 SHA；有 GitHub Issue 的用 `gh issue close` 关闭；在「执行日志」追加一行。
5. **阻塞**：状态改 `blocked` 并在备注写原因，换下一个可做的 task，不要空转。
6. **新增任务**：新建 task 文档 + `gh issue create --label feeds-sprint-1` + 更新 `context.md` 任务表与 `status.md`。新任务必须独立；不独立则声明依赖与优先级（参考 context.md 的分组说明）。

## 本仓快速命令

```bash
bun run typecheck                      # backend + frontend 类型检查
bun run dev:backend                    # 后端 :4000（默认启用 /admin 与 /api/admin/db/*）
bun run dev:frontend                   # 前端 :3000
cd backend && bun run data:sync:trending && bun run data:sync:starred  # 数据同步
gh issue create -R variableway/innate-feeds -l feeds-sprint-1 ...
```

## 提交约定

- 分支：`qdriven/issue-<n>`；提交信息用 conventional commits（`feat:` / `docs:` / `chore:`）。
- Sprint 文档与代码改动同一 PR 提交，PR 描述列出完成的 task。
