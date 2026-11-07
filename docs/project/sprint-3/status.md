# Sprint 3 状态总表（单一事实来源）

> GitHub 归档：16 个任务对应 issues #43–#58（已关闭，标签 sprint-3）。

| Task | 内容 | 状态 | 提交 SHA |
|---|---|---|---|
| task-A1 | collectors 任务注册表 + 单任务 CLI + M-Sync 边界固化 | todo | — |
| task-B1 | AIHot token 叠加 | todo | — |
| task-B2 | 布局原语：ReadingLayout / EmptyState / PillTabs | todo | — |
| task-B3 | 主页改版：日分组时间轨精选流 | done | 642754d |
| task-B4 | /trending 热点榜三层结构 | done | 836acc2 |
| task-B5 | /trending-shift 行榜换装 | done | 68e43c2 |
| task-B6 | /edu 域 AIHot 卡片网格化 | done | 13aaf2d |
| task-B7 | nav-visibility 收敛 + 全量验收 | done | 89391b8 |
| task-B8 | AIHot 配色整体迁移 + 图标语言对齐 | done | b585d2c |
| task-B9 | 「主题」主导航组（Education 入驻） | done | 043228b |
| task-B10 | UI/UX Design 主题域（数据收集+域包） | done | 5ed0739 |
| task-B11 | edu categories 并入主页，菜单改 EDU | done | 5ed0739 |
| task-B12 | /ux SKILL 加权视图 + edu 微调 + 全局 404 | done | cff33d2 |
| task-B13 | EDU 打分 + /ux 过滤器与 Tags | done | b103311 |
| task-B14 | B 站视频采集 + 域页合流 + 说明文档 | done | 472d0f4 |
| task-B15 | trending 去重 + 配色加深 + edu/ux 修整 + 静态验证 | done | b3d153f |

## 执行日志

- 2026-11-07 task-B15 done（b3d153f）：trending 跨日重复修复（根因：多快照日未去重）、配色加深、ux tag 筛选上线、静态模式验证通过。sprint-3 计 16 任务。

- 2026-11-07 task-B14 done（472d0f4）：B 站采集链路打通（search→mid→渲染抓取→正则），42 条真实视频上线 /edu/videos。sprint-3 计 15 任务。

- 2026-11-07 task-B13 done（b103311）：EDU/ux 打分与筛选形态对称化。sprint-3 计 14 任务。

- 2026-11-07 task-B12 done（cff33d2）：/ux 以 SKILL 为本体（×5 加权），edu 筛选一行化，全局 404。sprint-3 计 13 任务。

- 2026-11-07 task-B10 + B11 done（5ed0739）：UI/UX Design 主题上线（10 topic 数据 + Hub 域包），edu 精简为 EDU。sprint-3 计 12 任务。

- 2026-11-07 task-B8 done（b585d2c）+ task-B9 done（043228b）：sprint-3 计 10/10 任务收官。

- 2026-11-07 追加 task-B8（AIHot 配色+图标）/ task-B9（「主题」主导航组）——用户看效果后提出。

- 2026-11-07 task-B7 done（89391b8）：nav-visibility 上线，sprint-3 全部 8 任务完成。全量验收：可见 6 页 + hidden 4 页直达 200、typecheck 四处、bun test 102/0、build:static 绿。

- 2026-11-07 task-B6 done（13aaf2d）。
- 2026-11-07 task-B5 done（68e43c2）。
- 2026-11-07 task-B4 done（hot-board.tsx + FeedListPage hotBoard 模式；SHA 于本 docs 提交前一个 feat 提交）。
- 2026-11-07 task-B3 done（642754d）：主页时间轨上线，/ 不再重定向。
- 2026-11-07 task-B2 done（f34cae9）：layout 原语三件套。
- 2026-11-07 task-B1 done（eea452e）：token 叠加，暗色完整，零回归。
- 2026-11-07 task-A1 done（793e6ea）：注册表 + sync job CLI + 边界固化；发现并如实记录 module-partition「server 不引 collectors」假设与实测的偏差。

- 2026-11-07 sprint 立项（8 任务：A1 + B1-B7）。
