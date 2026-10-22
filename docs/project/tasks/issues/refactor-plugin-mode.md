# Task log: refactor-plugin-mode

Issue：[issues/refactor-plugin-mode.md](../../issues/refactor-plugin-mode.md)（源：GitHub #2）

## 2026-10-22 — in_progress

- 读 issue #2 与 `docs/project/` 入口；摸清 innate-fe monorepo（webshell / `@innate/web-domain` / `@innate/ui` / `innate-fe-cli` / `plugins.registry.yaml`）
- 与用户确认范围：只做分析 + 迁移方案文档；轨道 A（domain）；彻底去壳；**独立仓不合并进 innate-fe，保留插件能力**

## 2026-10-22 — done

- 分析：[datasource-frontend-separation.md](../../../arch-design/datasource-frontend-separation.md) — 判定分离已满足；记录 3 处耦合（类型两写、`shared/` 非真包、基础 UI 内嵌）
- 方案：[innate-fe-plugin-migration.md](../../../arch-design/innate-fe-plugin-migration.md) — 去壳清单、domain 契约映射、`innate-fe-cli` 仓外接入、P0–P4 分阶段、§6 待定项
- 验收：两份文档就位；结论「分离已满足，可迁移」
- 状态变更：open → done（本期文档交付）

## 2026-10-22 — in_progress（实施 P0–P4）

- 用户确认：独立仓不合并进 innate-fe，保留插件能力；直接落地全部阶段

## 2026-10-22 — done

- **P0**：新增 `packages/web-domain`（`@innate/web-domain` 契约 + standalone router）、`packages/ui`（`@innate/ui`，61 原语 + `use-mobile`）；`shared/` 注册为 `@innate/shared` workspace 包；backend/frontend 引用改 `workspace:*`
- **P1**：`frontend` 更名 `@innate/domain-feeds`；`src/index.ts` + `src/web-domain.tsx`（全部路由工厂 + `navItems`/`homeTile`）；`plugin.json`（`innate.plugin.v1`, `kind: domain`）
- **P2**：删 `app-sidebar` / `app-header` / `lib/theme` / `pages/__root` / 全部 `route.tsx`；`components/ui` 迁 `packages/ui`；业务件改 `@innate/ui/components/*`
- **P4**：`src/main.tsx` 最小宿主（`createStandaloneWebDomainRouter`）；`bun run typecheck`（backend+frontend）、`bun run test` 34 passed、`frontend build` 226 files 全绿
- 证据：`frontend/src/{index,web-domain,domain-layout,main}.tsx`、`frontend/plugin.json`
- 状态变更：in_progress → done（P3 待 innate-fe 侧配合）

## 2026-10-22 — in_progress（packages/ 冗余核查）

- 用户质疑：innate-fe-cli install/build 下 `packages/` 内容是否多余 → 核查 `innate-fe-cli` 源码确认
- 发现：`gen` 只 copy `from:` 目录；`install` 发布基础仓 `packages/` 并改写消费方 `workspace:*` —— 本地 `packages/` 在该链路是死代码
- 另发现 bug：`@innate/shared` 用 `@innate` scope 但不在基础仓发布集合 → `install` 报 missing 抛错

## 2026-10-22 — done

- **删除 `packages/`**（ui + web-domain）；`shared/` 移出 `@innate` scope（tsconfig paths / 相对路径）
- **`@innate/*` 改走 `innate-fe-cli install`**：Verdaccio 发布 → `.npmrc` → 改写 `workspace:*` → `^0.1.0`
- 新增 `bun run setup:innate`；CI/deploy 双仓检出 + install；gitignore 生成物
- 验证：真实 `install --dir frontend` 装入 `@innate/ui@0.1.0` / `@innate/web-domain@0.1.0`；typecheck / 34 tests / build 全绿
- 状态变更：in_progress → done

## 2026-10-22 — done（独立态导航 + 收尾）

- 用户反馈独立态无 sidebar（去壳副作用）→ 新增 `frontend/src/host-shell.tsx`：**紧凑左栏**（w-40），host-only 不进 domain；导航项读 `webDomain.capabilities.navItems`（与插件态同源）
- 新增 `bun run dev`（concurrently 一键前后端）、`bun run dev:seed` / `data:seed`（静态快照导入，解决空库无数据）
- playwright 实测：侧栏渲染、Trending/Starred 数据、导航跳转、active 高亮均正常
- 更新 `AGENTS.md` 仓库布局与「Where to make changes」
- 状态变更：done（P3 仅待 innate-fe 侧 `plugins.registry.yaml` 登记联调）



