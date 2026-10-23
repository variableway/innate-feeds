# T5：启动参数控制（默认启用后台管理查询）

- **Issue:** https://github.com/variableway/innate-feeds/issues/11
- **依赖:** T3（admin 路由存在）
- **分组:** admin 组；与 T4 可并行
- **验收:** 见下。

## 任务描述

Issue 要求：这个后台简化版**启动需要参数控制，默认启动后台管理查询**。

实现：

- 默认（无参数）：admin 路由挂载，`/admin` 与 `/api/admin/db/*` 可用。
- 关闭方式（任一）：
  - CLI：`bun src/app/server.ts --no-admin`
  - 环境变量：`ADMIN_DB_UI=off`
- server 启动日志打印 admin 状态。
- `backend/package.json` 增加便捷脚本（如 `dev:no-admin`）。

## 验收记录

- [ ] 默认启动时 `/api/admin/db/tables` 可访问
- [ ] `--no-admin` 或 `ADMIN_DB_UI=off` 时返回 404
- [ ] README / AGENTS.md 文档同步
