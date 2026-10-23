# Sprint-1 任务状态总表

> **单一事实来源**：任何 Agent 动手前先读本表；完成后必须回写。
> 状态取值：`todo` / `in_progress` / `done` / `blocked` / `skipped(原因)`。
> 详细验收标准见各 task 文档；调研产出在 [`research/`](./research/)。

| Task | 说明 | 依赖 | Issue | 状态 | Agent | 完成 SHA / 备注 |
|---|---|---|---|---|---|---|
| R1 | 相似度查询方案调研 | 无 | #5 | done | claude-code | research/similarity-query.md；5 方案对比，前 3 已实测 |
| R2 | JSON 文件 SQL 查询方案调研 | 无 | #6 | done | claude-code | research/json-query.md；json_documents + json_each 已实测 |
| T1 | 项目初始化 | 无 | #7 | done | claude-code | pnpm + innate-fe-cli 接入，typecheck 双通过 |
| T2 | 最新数据同步进 SQLite | T1 | #8 | done | claude-code | 快照 2026-10-23，total 7114（trending 962 + starred 6152） |
| T3 | Admin DB API | T1、R1、R2 | #9 | done | claude-code | /api/admin/db/* 全端点 + 只读硬保证 + 7 单测通过 |
| T4 | Admin UI 三栏工作台 | T3 | #10 | done | claude-code | /admin，CodeMirror 6 高亮；顺带修 Windows 页面 404 bug |
| T5 | 启动参数控制 | T3 | #11 | done | claude-code | 默认启用；--no-admin / ADMIN_DB_UI=off 关闭 |

## 执行日志（追加式，最新在上）

- 2026-10-23 claude-code：Sprint 全部任务（R1/R2/T1–T5）完成，Issue #5–#11 全部关闭；Sprint 总结见 PR（closes #4）。
- 2026-10-23 claude-code：R1/R2/T1/T2 完成，Issue #5 #6 #7 #8 已关闭；开始 T3。
- 2026-10-23 claude-code：Sprint 建档（context / status / task 文档 / research 占位）。

## 已知遗留（不阻塞 Sprint 验收）

- 仓库 vitest 配置无法解析 bun 专属导入（`with {type:"text"}`），测试用 `bun test` 执行（既有问题，另开 Issue 可跟进）。
- T4 顺带修复 server.ts `mountWebsite` Windows 路径分隔符 bug（`toPosix`）。
- `~/.innate` 下暂无外部收集器 JSON（producthunt/yc/a16z 未跑）；admin 的 JSON 扫描已用 `ADMIN_JSON_DIR` 指向仓库根验证（233 文件）。
