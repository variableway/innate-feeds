# task-B7：nav-visibility 收敛 + 全量验收

## 计划（开工前）

- 做什么：新增 `frontend/src/nav-visibility.ts`（host 侧可见性裁量），HostShell 过滤后导航仅：Home / Trending / Trending Shift / Starred / Education / SQLite(admin)；digest/feeds/topics/dsh hidden（路由保留 URL 直达）；AGENTS.md 同步；sprint 全量验收。
- 功能点：①可见性配置单点 ②hidden 页路由保留 ③验收清单全绿。
- 如何验证：curl 各可见页 200；hidden 页 URL 直达仍 200；typecheck 四处 + bun test + build:static 全绿；导航 HTML 无 hidden 项。

## 完成回填（完成后）

- 做了什么：
- 完成的功能：
- 验证证明：
