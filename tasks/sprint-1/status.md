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

- 2026-10-26 claude-code：PR #12 合并（merge SHA 71aee1d），Issue #4 关闭。CI 全绿（Test & Type Check + Build）；每日 Pages 部署恢复成功，线上站点已更新至 2026-10-26 数据。本地 SQLite 二次刷新（trending 三榜 + starred 近 4 天增量，total 7125）。Sprint-1 全部收口。
- 2026-10-26 claude-code：修复 CI 前置条件——设置 `INNATE_FE_TOKEN` secret（私有基础仓 checkout）；根 `test` 脚本 vitest → `bun test`（41/41 通过）；同步 yc + github-topics 收集器，admin JSON 查询在真实数据上验证；AGENTS.md 测试说明更新。
- 2026-10-23 claude-code：Sprint 全部任务（R1/R2/T1–T5）完成，Issue #5–#11 全部关闭；Sprint 总结见 PR（closes #4）。
- 2026-10-23 claude-code：R1/R2/T1/T2 完成，Issue #5 #6 #7 #8 已关闭；开始 T3。
- 2026-10-23 claude-code：Sprint 建档（context / status / task 文档 / research 占位）。

## 已知遗留（不阻塞 Sprint 验收）

- ~~仓库 vitest 配置无法解析 bun 专属导入~~ → **已修复（2026-10-26）**：根 `test` 脚本改为 `bun test`（vitest 兼容层），41/41 测试通过；AGENTS.md 测试说明已同步。
- ~~`~/.innate` 下暂无外部收集器 JSON~~ → **已修复（2026-10-26）**：`sync yc` + `sync github-topics` 已灌入 9 个真实 JSON（2.3MB），admin JSON 扫描（默认目录）与 `json_each` 展开实测通过；保存查询种子更新为 items 展开写法。
- ~~CI / Pages 部署在 main 上自 2026-10-22 起失败~~ → **已修复（2026-10-26）**：① 设置 `INNATE_FE_TOKEN` secret（私有基础仓 checkout，建议后续换成仅含 innate-fe 读权限的 fine-grained PAT 并轮换）；② 根安装从 `bun install` 切到 `pnpm install`（CI 每次全新发布 @innate/* 0.1.0 tarball，bun.lock 完整性哈希永远对不上；pnpm-lock 本就在 .gitignore，是仓库既定路径）。PR #12 合并后 CI 全绿、每日 Pages 部署恢复成功（run 40257414133），线上 https://variableway.github.io/innate-feeds/ 已更新至 2026-10-26 数据。
