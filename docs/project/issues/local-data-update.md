# 本地数据更新 + Orca 定时任务 + 数据源 review

> [GH #31](https://github.com/variableway/innate-feeds/issues/31) · 2026-10-31 · status: done

## 目标

1. 本地更新 GitHub、topic 等信息
2. 在 Orca 中创建定时任务跑这套更新
3. 完整 review 项目数据来源，写出文档（模块、来源、结构关系）

## 交付

| 子任务 | 交付物 |
|---|---|
| 1. 本地更新 | `bun run data:update:local`（trending daily + starred recent + digest 90d + topics + 8 个外部 JSON 源）；补齐此前从未同步的 github-topics 与过期 digest |
| 2. Orca 定时 | `innate-feeds-data-update` automation，每日 07:00 跑 `data:update:local`，数据落 `~/.innate`，不触碰 git |
| 3. 数据源文档 | [`docs/arch-design/data-sources.md`](../../arch-design/data-sources.md)：12+ 类数据源 × 模块 × 存储 × API × 前端映射、双部署消费链路、更新编排、扩展套路 |

同时新增 5 个社区数据源 + Feeds 前端菜单（HN / HuggingFace / GitHub New / Dev.to / lobste.rs，Reddit 按需求排除），并把既有无页面的 PH/YC/a16z 一并接入 `/feeds`。digest 新增 HelloGitHub（`521xueweihan/HelloGitHub`）源。

## 边界

- **数据不提交 GitHub，只提交代码**：数据落 `~/.innate`（仓库外）；`frontend/public/data/external/` 已加入 `.gitignore`；Pages CI 在 runner 内生成数据产物、只上传不提交。
- HuggingFace 采集器在部分网络（含本机）不可达会跳过，CI 正常。
- **后续（GH #33）**：2026-10-31 首跑发现 Product Hunt 抓到 0 条且无报错，已把 producthunt 从 `data:sync:external`（每日编排）移除，修复后再恢复。
