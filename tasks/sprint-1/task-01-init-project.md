# T1：项目初始化

- **Issue:** https://github.com/variableway/innate-feeds/issues/7
- **依赖:** 无
- **验收:** 见下。

## 任务描述

让仓库在本机达到可开发状态：

1. `innate-fe-cli install`（发布 `@innate/ui` / `@innate/web-domain` 到私有源并接入 frontend；基础仓位置由仓库根 `.innate-fe-cli.json` 指向）。
2. `bun install`（backend + frontend 依赖）。
3. `bun run typecheck`（backend + frontend）通过。
4. 后端可启动：`bun run dev:backend`（http://localhost:4000，`/api/health` 返回 ok）。

## 验收记录

- [x] `bun install` 成功（pnpm install 330 包；注：@innate 私有源解析需 root `.npmrc`，已按 setup:innate 流程 `cp frontend/.npmrc .npmrc`）
- [x] `frontend/node_modules/@innate/ui` 与 `@innate/web-domain` 就位
- [x] `bun run typecheck` 通过（backend + frontend 均 0 退出）
- [x] `/api/health` 返回 `{ ok: true }`
