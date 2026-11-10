# Sprint 4 状态总表（单一事实来源）

> GitHub 归档：4 个任务对应 [issue #68](https://github.com/variableway/innate-feeds/issues/68)
>（拆解执行，不另开子 issue；全部 done 后关闭 #68）。

| Task | 内容 | 状态 | 提交 SHA |
|---|---|---|---|
| task-01 | 分类表设计 + topic 种子实证（research） | done | df5c1d6 |
| task-02 | shared 分类表契约 + 采集清单扩充 + 实跑同步 | done | f2328b8 |
| task-03 | EDU 三分组归类与查询支持 | done | f2328b8 |
| task-04 | /topics 分类+步骤两级查询 UI + 静态验证 | done | 6b092d7 |

## 执行日志

- 2026-11-10 task-04 done（6b092d7）：/topics 两级查询 UI 上线（2 分类 × 8 组 +
  步骤序号 + ?group=/?step= 深链），API/静态双模式 dump-dom 验证通过；顺修
  preview.ts Windows 路径 bug。sprint-4 计 4 任务收官。
- 2026-11-10 task-02 + task-03 done（f2328b8）：shared 分类表契约 + DEFAULT_TOPICS
  扩容至 90（含 Search API 限速护栏）+ 55 新 topic 实跑落盘 + 静态导出 +
  EDU 8 类→3 组映射 + 6 例不变量测试。期间另修存量 bug
  9ea3a56（hot_snapshots 命名参数绑定走 atParams，修 heat.test 1 例红）。
- 2026-11-10 task-01 done（df5c1d6）：64 候选 topic 实证，8 组定稿（56 采纳/8 淘汰）。
- 2026-11-10 sprint-4 脚手架建立（issue #68 拆解为 4 任务）。
