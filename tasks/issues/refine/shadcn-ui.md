#  Refine shadcn-ui

当前项目依赖于shadcn-ui,但是是使用了，innate-fe-frontend的shadcn-ui版本，现在想要用官方的shadcn-ui，base-ui的版本的，需要更新项目依赖。

## Task 1: 更新shadcn-ui

1. 把shadcn-ui最新v4的component全部都放入到当前项目，frontend里面
2. 同时按照shadcn-ui的官方开发skill
3. 确认项目可以运行

> **✅ 完成（2026-09-20，zcode）**
>
> - 新增 `frontend/components.json`：官方 shadcn CLI 配置，style `base-vega`（Base UI 版本），aliases 用 `@/*`，CSS 指向 `src/styles.css`。
> - 用官方 CLI（`npx shadcn@latest add --all`，v4.21.0）把 registry 全部 **61 个组件** vendor 进 `frontend/src/components/ui/`（accordion … tooltip，含新增的 attachment / bubble / combobox / message / questionnaire / toast 等），以及 `src/hooks/use-mobile.ts`。
> - 行为原语为 `@base-ui/react@^1.8`（官方 Base UI 版 shadcn），`cn` 用官方 `cn` 包；CLI 漏装 `class-variance-authority`（16 个组件引用）已手动补装。
> - `src/styles.css` 补 `@import "tw-animate-css"`（dialog/popover 等的 animate-in/out 依赖）并安装依赖；现有 neutral 主题 token 与 `@theme inline` 完全兼容，未改动主题。
> - **移除 `@innate/ui` file: 依赖**（frontend/src 里 0 引用的死依赖），同时清理 `vite.config.ts` 里死掉的 `@innate/ui/themes` alias 和 `server.fs.allow` 里的 innate-fe-base 路径。
> - 按官方工作流加脚本：`bun run shadcn:add <name>` / `bun run shadcn:update`（`frontend/scripts/update-shadcn.sh`，逐一 re-fetch 最新 registry 版本）；AGENTS.md 已补充组件目录、技术栈与命令说明。
> - 验证：root `bun install` 一致；backend + frontend `typecheck` 通过；`vite build` 成功（2021 modules）；`vite preview` 冒烟 HTTP 200。
> - 附带效果：`@innate/ui` 是本地 `file:../../../../base/...` 路径依赖，GitHub Actions runner 上不存在 → **CI 自 09-11 起每日 `bun install` 失败、Pages 数据断更**（见 Task 2）。移除后 CI 恢复可装。

## Task 2:  Github 项目更新

1. Github的项目Daily Trending是否可以补没有更新的数据
2. 如果不行，可以放弃

> **❌ 结论：无法补录，按任务说明放弃（2026-09-20，zcode）**
>
> - **缺口范围**：仓库内静态导出（`frontend/public/data/manifest.json`，最后生成 09-10）覆盖 06-26 → 09-10，仅缺 06-27/06-28；之后 **09-11 → 09-19 共 9 天**完全没有快照。本地 SQLite（`~/.innate/feeds.db`）缺口更大（另有 08-14 → 09-19 等）。
> - **为什么补不了**：GitHub Trending 没有官方 API，也没有任何历史/日期参数（`github.com/trending?since=` 只控制时间窗口，榜单永远是"当前"）。采集器只能抓当下页面：`backend/src/collector/sync.ts:24` 的 `snapshotDate = new Date()...` 固定取当天，CLI 的 trending 同步也不支持 `--date`（对比 Product Hunt 采集器支持 `--date`，因为它有按日归档的 leaderboard）。过去没抓到的榜单在 GitHub 侧已不存在，**无法找回**。
> - **断更根因（重要附带发现）**：`gh run list` 显示 deploy workflow 每天 cron 都在跑但全部失败（15~22 秒即挂），日志为 `ENOENT: failed to link package: @innate/ui@../../../base/innate-fe-base/packages/ui` —— `00add5b`（09-11 07:14 UTC 引入 `@innate/ui` file: 依赖）恰在当天 cron 之前合入，此后每日 `bun install` 失败导致 sync/export 全部中断。**Task 1 已移除该依赖，推送后 cron 即可恢复**，后续数据从当天继续累积。
> - 后续（可选）：推送后手动 Run workflow 验证一次绿的；缺失的 9 天接受为永久空洞。
> **✅ 后续（2026-09-20 晚，zcode）：GitHub Pages 已修复并恢复更新**
>
> - 根因链全部修复并推送：`@innate/ui` file: 依赖（fbb58ed）→ bun 构建迁移半成品（f7a09a1，补齐 `scripts/{build,dev,preview}.ts`、tsconfig、自包含 `vite-env.d.ts`、移除 vite）→ `shared/fe-base-themes.css` 引用本机路径（e938d1d，主题 CSS vendor 进 `shared/themes/`）。
> - `actions/checkout` 升 v5（Node 20 弃用警告）；vendored shadcn 组件加入 `.prettierignore`；存量文件格式化（23a5b63）。
> - 结果：CI ✅ + Deploy ✅（2026-09-20T12:44 UTC），线上 https://variableway.github.io/innate-feeds/ HTTP 200，trending 最新 chunk 为 2026-09-20；每日 cron（08:00 UTC）恢复自动更新。
