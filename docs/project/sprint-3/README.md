# Sprint 3 — 数据收集模块化 + AIHot 风格首波

> 2026-11-07 立项 · 依据：[module-partition-design](../../research/projects/module-partition-design.md) +
> [aihot-ui-adoption](../../research/projects/aihot-ui-adoption.md)（用户目标驱动的 delta 见 [00-architecture.md](./00-architecture.md)）

## 目标

1. **数据收集完全抽取**：每个采集器是可独立运行的小模块，各有 CLI 命令；
   serve 服务照旧提供同样的数据（零行为变化）。
2. **AIHot 风格首波**：主页、GitHub Trending、Trending Shift、Education（/edu）四块。

## 任务索引（15 任务，2026-11-07）

| Task | 内容 | 状态 | 提交 |
|---|---|---|---|
| [task-A1](./task-A1.md) | collectors 任务注册表 + 单任务 CLI + 边界固化 | done | 793e6ea |
| [task-B1](./task-B1.md) | AIHot token 叠加（ink/hot/rank/radius 六档） | done | eea452e |
| [task-B2](./task-B2.md) | 布局原语（ReadingLayout / EmptyState / PillTabs） | done | f34cae9 |
| [task-B3](./task-B3.md) | 主页改版：日分组时间轨精选流 | done | 642754d |
| [task-B4](./task-B4.md) | /trending 热点榜三层结构 | done | 836acc2 |
| [task-B5](./task-B5.md) | /trending-shift 行榜换装 | done | 68e43c2 |
| [task-B6](./task-B6.md) | /edu 域 AIHot 卡片网格化 | done | 13aaf2d |
| [task-B7](./task-B7.md) | nav-visibility 收敛 + 全量验收 | done | 89391b8 |
| [task-B8](./task-B8.md) | AIHot 配色整体迁移 + 图标语言对齐 | done | b585d2c |
| [task-B9](./task-B9.md) | 「主题」主导航组（Education 入驻） | done | 043228b |
| [task-B10](./task-B10.md) | UI/UX Design 主题域（数据收集+域包） | done | 5ed0739 |
| [task-B11](./task-B11.md) | edu categories 并入主页，菜单改 EDU | done | 5ed0739 |
| [task-B12](./task-B12.md) | /ux SKILL 加权视图 + edu 微调 + 全局 404 | done | cff33d2 |
| [task-B13](./task-B13.md) | EDU 打分 + /ux 过滤器与 Tags | done | b103311 |
| [task-B14](./task-B14.md) | B 站视频采集 + 域页合流 + 说明文档 | done | 472d0f4 |

依赖：A1 独立；B1 → B2 → (B3/B4/B5/B6 并行序贯) → B7。

## 工作流约定（本 sprint）

- 逐任务执行：认领（status.md 置 in_progress）→ 实现 → 验证 → 回填 task 文档
  「完成回填」段 → status.md 置 done + 记提交 SHA → commit。
- 任务文档双段结构：**计划段**（做什么/功能点/如何验证，开工前写）+
  **完成回填段**（做了什么/完成的功能/验证证明位置，完成后写）。
- 数据文件（frontend/public/data 等）不入提交；验证证据以命令输出 + 提交 SHA 为准。
