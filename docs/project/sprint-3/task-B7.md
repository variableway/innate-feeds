# task-B7：nav-visibility 收敛 + 全量验收

## 计划（开工前）

- 做什么：新增 `frontend/src/nav-visibility.ts`（host 侧可见性裁量），HostShell 过滤后导航仅：Home / Trending / Trending Shift / Starred / Education / SQLite(admin)；digest/feeds/topics/dsh hidden（路由保留 URL 直达）；AGENTS.md 同步；sprint 全量验收。
- 功能点：①可见性配置单点 ②hidden 页路由保留 ③验收清单全绿。
- 如何验证：curl 各可见页 200；hidden 页 URL 直达仍 200；typecheck 四处 + bun test + build:static 全绿；导航 HTML 无 hidden 项。

## 完成回填（完成后）

- 做了什么：新建 `frontend/src/nav-visibility.ts`（`isNavPathVisible`：VISIBLE_PATHS 精确集 + /edu、/starred 前缀集）；`host-shell.tsx` 的 `navItemsOf` 聚合后过滤；`web-domain.tsx` feeds 域 navItems 新增「主页」项（path "/"，order 5）。
- 完成的功能：①侧栏收敛为 6 项：主页 / Trending / Trending Shift / Starred / Education / SQLite（admin 工具）②hidden 四组（digest / topics / feeds 外部源 / dsh）路由全部保留、URL 直达可用、数据管道照常（local-daily 不变）③可见性单点配置，M2 curation/visibility.ts 落地后退化为消费方。
- 验证证明（2026-11-07 实测）：可见页 //trending//trending-shift//starred//edu//admin 全 200；hidden 页 /digest //topics//feeds//dsh 直达全 200；`/__dev_main.js` 含 isNavPathVisible ×2（SPA 侧栏由客户端过滤，bundle 逻辑为准）；`bun run typecheck` 四处绿；`bun test backend/src` 102 通过 0 失败；`bun run build:static` 完整通过。提交 **89391b8**。
