# Plan: 完成 Tauri v2 桌面化 + Web 集成（含可分发安装包）

## 目标
补全进行中的 Tauri v2 桌面壳，让 innate-feeds 的 web 前端作为桌面应用运行；后端编译为独立 sidecar 二进制，最终产出可分发安装包（macOS .dmg，结构上预留 win/linux）。

## 现状（已核实）
- `src-tauri/` 仅有 `gen/schemas/` + `resources/backend/`（桌面增强后端副本）+ 空 `target/`。**缺失**：`Cargo.toml`、`tauri.conf.json`、`src/*.rs`、`capabilities/`、`icons/`。
- 生成的 `capabilities.json` 揭示原配置：窗口 `main`，权限 `core:default` + `core:path:default` + 自定义 `allow-get-backend-info`；插件仅 `core` + `log`（无 shell 插件 → 后端由 Rust 直接 spawn）。
- `resources/backend` 比真实 backend 多：`/api/health`、`/api/auth/status|pat`（PAT 加密存储 aes-256-gcm）、`HOST`/`DB_PATH` 环境支持、`auth/` 模块（gh-status、token-store）。
- 前端 `@tauri-apps/api@2.11.1` 已装但未声明、未使用；`feeds.ts` 用相对 `/api` 或 static 模式。
- 工具链齐全：bun 1.3.11、cargo/rustc 1.94、tauri-cli 2.11.x（v2）。
- 测试基线 23 通过（vitest 实际跑在 **node** 运行时；强制 bun 运行时下 better-sqlite3 失败）。
- 已实测：`bun:sqlite` API 兼容（`@`命名参数、`db.exec("PRAGMA ...")`、CHECK 约束生效、`:memory:`），`Hono + Bun.serve` 可用。

## 决策（已与用户确认）
- 范围：含可分发安装包。
- SQLite：移植到 `bun:sqlite`（无原生模块）→ `bun build --compile` 产出干净独立二进制。会动到 web 共用后端。

## 实施步骤

### 1. 后端 Bun 原生化 + 合并桌面增强（web 与 desktop 共用一份）
- `backend/src/db/index.ts`：`better-sqlite3` → `bun:sqlite`。`import { Database } from "bun:sqlite"`；类型 `Database.Database` → `Database`；`db.pragma(...)` → `db.exec("PRAGMA ...")`。SQL 不变。
- `backend/src/db/index.test.ts`：同样移植。
- schema 加载：`readFileSync(__dirname/"schema.sql")` → `import schemaSql from "./schema.sql" with { type: "text" }`（`--compile` 时自动嵌入）。新增 `declare module "*.sql"` 类型声明。
- `backend/src/app/server.ts`：`@hono/node-server` 的 `serve(...)` → `Bun.serve({ port, hostname, fetch: app.fetch })`。并入桌面增强（`/api/health`、`/api/auth/*`、`HOST`、`DB_PATH` 日志）——取自 `resources/backend/src/app/server.ts`。
- 把 `resources/backend/src/auth/`（gh-status、token-store、index）迁入 `backend/src/auth/`。删除 `resources/backend/`（不再保留副本，消除漂移）。
- `backend/package.json`：移除 `@hono/node-server`、`better-sqlite3`、`@types/better-sqlite3`、`tsx`；新增 `@types/bun`(dev)。脚本 `tsx ...` → `bun ...`（dev=`bun --watch`、start=`bun`、sync/cli/export=`bun`）。新增 `build:sidecar`。
- 根 `package.json`：`test` 改为 `bun --bun vitest run`（强制 bun 运行时，让 `bun:sqlite` 可导入；CI 走 `bun run test` 仍可用）。
- `Dockerfile`：`CMD ["bun","run","start"]` 不变（已是 bun 运行时 + Bun.serve）；移除原生模块编译，构建更快。验证仍可起服。
- `dev.sh`：基本不变（`bun run dev` 仍有效；可选把就绪探测改 `/api/health`）。

### 2. 构建 sidecar 二进制
- `backend` `build:sidecar`：`bun build --compile --target=<host-triple> --outfile=../src-tauri/binaries/innate-feeds-backend src/app/server.ts`。纯 JS + `bun:sqlite`（内置），无原生模块 → 干净二进制。
- 验证：独立运行该二进制，`/api/health` 返回 200。

### 3. 重建 Tauri v2 壳（`src-tauri/`）
- `Cargo.toml`：`tauri` 2、`tauri-plugin-log`、`serde`、`serde_json`、`tokio`（或 reqwest 阻塞探活）。
- `build.rs`：`tauri_build::build()`。
- `tauri.conf.json`：productName `Innate Feeds`、identifier `com.variableway.innatefeeds`；`build.devUrl=http://localhost:3000`、`frontendDist=../frontend/dist`、`beforeDevCommand`/`beforeBuildCommand`（前端 dev/build）；`app.windows` `main`（1280×800）；`bundle.resources` 含 `binaries/innate-feeds-backend`；`bundle.targets` 含 `app`,`dmg`；`security.csp` 放行 `connect-src http://127.0.0.1:*` 与 `img-src https:`；macOS 最低系统版本。
- `src/main.rs` + `src/lib.rs`：
  - setup：解析 sidecar 路径（`resource_dir/binaries/innate-feeds-backend[.exe]`）；选取空闲端口；以 env `HOST=127.0.0.1`、`PORT`、`DB_PATH=<appData>/feeds.db`、`INNATE_HOME=<appData>` spawn；句柄存 state；轮询 `http://127.0.0.1:port/api/health` 至就绪（超时 ~15s）；退出时 kill sidecar。
  - 命令 `get_backend_info` → `{ host, port, ready }`。
  - 注册 `tauri-plugin-log`。
- `capabilities/default.json`：`core:default`、`core:path:default`、`allow-get-backend-info`、`log:default`（不引入 shell 插件，手动 spawn）。
- `icons/`：手写 SVG 源 → `bunx tauri icon icon.svg` 生成全平台图标集。

### 4. 前端桌面集成
- `frontend/package.json`：新增 `@tauri-apps/api ^2.11.1`（node_modules 已有）。
- 新增 `frontend/src/lib/desktop.ts`：`isTauri()`（`window.__TAURI_INTERNALS__`）；`getBackendInfo()` 动态 `import('@tauri-apps/api/core')` 后 `invoke('get_backend_info')`；结果缓存。
- `frontend/src/services/feeds.ts`：新增 `resolveApiBase()`——`isTauri() && !IS_STATIC` 时 `await getBackendInfo()` 返回 `http://127.0.0.1:port/api`，否则 `/api`；所有 fetch 改用 `resolveApiBase()`（函数本就 async）。
- static 模式（GitHub Pages）不受影响：`@tauri` 代码经 `isTauri()` + 动态 import 死分支，不进 web 包。

### 5. 脚本与验证
- 根 `package.json`：`tauri:dev`=`bunx tauri dev`；`tauri:build`=`bun run sidecar:build && bunx tauri build`；`sidecar:build`=`cd backend && bun run build:sidecar`。
- 验证：`bun run test`（强制 bun 下全绿）；`typecheck`；`bun run tauri:dev`（窗口打开、前端加载、sidecar 就绪、feeds 渲染）；`bun run tauri:build`（产出含 sidecar 的 .dmg，安装后启动验证 feeds 与 `/api/auth/status`）。

## 风险与备注
- vitest 强制 bun 运行时：已验证可跑（此前唯一失败是 better-sqlite3）；bun:sqlite 预期通过。兜底：若 vitest-under-bun 出问题，引入极小 DB 适配层（运行时 bun:sqlite、测试 node+better-sqlite3）。
- schema.sql 嵌入：text import 在 `--compile` 下嵌入；兜底改为内联 TS 字符串。
- 跨平台（win/linux）安装包：结构上预留 target triple，MVP 交付 macOS .dmg；CI release 工作流作为后续。
- `gh` CLI 依赖：starred 同步需 `gh` 在 PATH 或已存 PAT；trending 走 Firecrawl。鉴权端点会暴露该状态，不阻塞桌面启动。

## 不在本次范围（后续）
- CI release 工作流（按 OS 产出安装包）。
- PAT 管理前端 UI（鉴权端点已就绪，暂无 UI）。
- 文档同步（AGENTS.md / docs/project 记录桌面变体 + ADR-D2/D5）。
