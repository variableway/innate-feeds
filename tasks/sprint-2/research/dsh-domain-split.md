# R1：DSH 插件目录转 innate-fe-cli 域插件模式 —— 可行性与方案

> Issue: [#13 feeds项目重构](https://github.com/variableway/innate-feeds/issues/13)（epic）
> 日期：2026-10-26 · 结论：**可行，建议实施**
> 关联前置：[innate-fe-plugin-migration.md](../../../docs/arch-design/innate-fe-plugin-migration.md) §6-4（当时决策「dsh 先合入 feeds domain，体积大再拆」——本文即「再拆」的评估）

## 1. 问题

Issue #13 问：awesome dsh plugin 目录能否也转成 innate-fe-cli 插件模式（像 `frontend/` → `@innate/domain-feeds` 那样），然后集成；可以则合并，**但 datasource 部分要抽离**。

## 2. 现状盘点（2026-10-26）

| 部分 | 位置 | 规模 | 与 feeds 的耦合 |
|---|---|---|---|
| DSH UI（4 页） | `frontend/src/pages/dsh/` | ~420 行 | 仅 `markdown-body`、`copy-install-button` 两个小组件（feeds 的 digest/repo 面板也用） |
| DSH 组件 | `frontend/src/components/plugin-*.tsx` | ~260 行（3 个，dsh 专用） | 无 |
| API 客户端（含静态模式搜索镜像） | `frontend/src/services/plugins.ts` | 177 行 | 无 |
| 类型 | `frontend/src/types/plugin.ts`、`types/dsh.ts` | ~50 行 | 无 |
| 路由 + navItem | `frontend/src/web-domain.tsx`（/dsh 等 4 条路由 + "Plugins" navItem） | — | 同文件混注册 |
| **datasource：目录加载/搜索** | `backend/src/data/plugin-catalog.ts` | 321 行（YAML→DTO + 搜索/排序/分页） | 与 feeds 导出管线同目录；被 `export-incremental.ts` 引用 |
| **datasource：API 路由** | `backend/src/app/server.ts` 内 `/api/plugins*` 5 条 | ~70 行 | 与 feeds 路由同文件 |
| **datasource：静态导出** | `export-incremental.ts` 里 plugins.json 切片 | ~20 行 | 埋在 feeds 导出管线中 |
| 数据 | `awesome/awesome-dsh-plugin/data/`（2742 个 YAML，6.9MB） | — | `DSH_PLUGIN_DATA_DIR` 可覆盖 |
| 分类常量 | `shared/plugin-categories.ts` | 31 行 | dsh 专用（前端 + backend 都 import） |
| Next.js 原型 | `dsh-plugin-directory/` | 整目录 | **死代码**：不在 workspaces、CI/docs 无引用 |

## 3. 契约核对（对 innate-fe 基础仓）

基础仓：`~/orca/workspaces/innate-fe/github-pages-website`（`~/.innate-fe-cli.json` 的 `feRoot`）。

| 契约 | 要求 | dsh 可满足性 |
|---|---|---|
| `scanDomains`（`innate-fe-cli/src/lib/registry.ts:62`） | 包名 `@innate/domain-` 前缀 + `src/index.ts` 存在（导出 `webDomain`） | ✅ 照抄 feeds 骨架即可；`pluginOrder` 取 30（feeds 20） |
| `plugins.registry.yaml` | domain 条目 `from:` 支持仓外相对路径（UC3 `domain-two` profile 已演示多 domain 共存） | ✅ `from: ../innate-feeds/dsh`（与 feeds 的 P3 登记一起做） |
| `install --dir` | 每个消费方目录各跑一次（写 .npmrc + 改写 workspace: 协议） | ✅ 新包直接声明 `@innate/*: ^0.1.0`（不用 workspace: 协议），根 `.npmrc` + `pnpm install` 即可，无需改写 |
| standalone 宿主 | `createStandaloneWebDomainRouter` **只吃单 domain**（`packages/web-domain/src/standalone.ts`） | ⚠️ 双 domain 同站需宿主侧自行组合（见 §4.3） |
| gen 拷贝 | `materializeDomain` 整目录 copy 进 `domains/<id>`，**不解析 tsconfig paths / 仓内相对依赖** | ⚠️ 域包须尽量自包含；`@innate/shared/plugin-categories` 的 paths 映射与 feeds 域一样存在 P3 联动问题（统一留待 P3 解决，不新增特例） |

## 4. 方案（已定为实施口径）

### 4.1 目标布局

```
innate-feeds/
├── backend/                    # feeds datasource；dsh API 改为挂载子应用
│   └── src/dsh/                # ★ 抽离出的 dsh datasource
│       ├── catalog.ts          #   （自 data/plugin-catalog.ts 迁入）
│       ├── routes.ts           #   Hono 子应用 /api/plugins*（自 server.ts 迁入）
│       └── export.ts           #   plugins.json 导出（自 export-incremental.ts 切出）
├── frontend/                   # @innate/domain-feeds：删 /dsh 路由与迁移文件；
│   └── src/main.tsx            #   standalone 宿主组合双 domain（host-only，不进打包面）
├── dsh/                        # ★ @innate/domain-dsh（新域插件包，自包含）
│   ├── src/index.ts            #   export { webDomain }
│   ├── src/web-domain.tsx      #   createWebDomain("dsh")，路由保留 /dsh 前缀
│   ├── src/{pages,components,services,types,lib}/
│   └── plugin.json             #   innate.plugin.v1, kind: domain, id: dsh
├── shared/plugin-categories.ts # 原地不动（已是跨层常量位；避免 datasource→domain 反向依赖）
├── awesome/                    # 数据不动（datasource 的数据面）
└── (删除 dsh-plugin-directory/) # 死代码清理
```

### 4.2 关键决策与理由

1. **dsh 拆独立域包，而非留在 feeds 域**：业务上「插件目录」与「feeds 浏览」是两个领域（navItem 分组已是 "DeepSeek Harness" vs "GitHub"）；UI 耦合面实测只有 2 个小组件 + 分类常量，拆分成本低。
2. **路由保留 `/dsh` 前缀**：URL 不变（外链/书签不碎），且与 feeds 域在同一个 router 里天然不冲突——这也正是多 domain 共存的命名空间方式。
3. **datasource 抽离 = backend 内独立模块树 + Hono 子应用**：`backend/src/dsh/`（catalog/routes/export）。不做顶层独立包——backend 本就是 API 宿主进程，抽成 `backend/src/dsh/` 即可与 feeds 数据层（`data/`、`collector/`）划清边界，且零构建管线改动。域包不持有目录加载逻辑（这正是 issue 要求的「datasource 部分抽离」）。
4. **分类常量留在 `shared/`**：它同时被 backend（YAML 校验）与 dsh UI（标签）消费，属跨层常量；迁入域包会造成 datasource→domain 的反向依赖。~~dsh 域 tsconfig 以 paths 映射引用~~ → **实施修正（T3）**：tsc 的 paths 是 program 级全局，dsh 源码被 frontend typecheck 拉入同一 program 时别名会错解析，故 dsh 包内统一改相对导入（含 shared）；gen 拷贝自包含问题与 feeds 一并留待 P3。
5. **`markdown-body` / `copy-install-button` 在 dsh 域内各 vendor 一份**（69 + 27 行）：域包必须自包含（gen 整目录拷贝不解析跨包相对导入）；两处演进独立可接受。feeds 侧原件保留（digest/repo/settings 仍用）。
6. **standalone/Pages 维持单站双域**：`frontend/src/main.tsx`（host-only）建根路由后把 feeds、dsh 两个 domain 的 route factory 都挂上，`HostShell` 聚合两域 navItems。保持现有导航体验与部署产物形态；域包本体保持纯净（组合逻辑全在 host 文件，不进 `domains/` 打包面）。
7. **innate-fe 侧 registry 登记不在本期**：与 feeds 的 P3 同批做（基础仓另仓 PR）。本期交付「随时可登记」状态 + 本文档 §6 的登记片段。
8. **删除 `dsh-plugin-directory/`**：Next.js 原型早已被 frontend `/dsh` 取代，无任何引用。

### 4.3 宿主组合双 domain 的实现要点

`createStandaloneWebDomainRouter` 单域限制 → host 侧自建：

```ts
// main.tsx（host-only，概念示例）
const root = createRootRoute();
const children = [webDomainFeeds, webDomainDsh].flatMap(d => d.routes.map(s => s.factory(root)));
const router = createRouter({ routeTree: root.addChildren(children), history: createBrowserHistory(), basepath });
// HostShell 改收 WebDomain[]，navItems 取并集后按 group 归类
```

两个域的 layout route 各自有 `id`（"feeds" / "dsh"），TanStack 允许同父下多个 id 路由，路径不重叠即无冲突。

### 4.4 构建管线

- dsh 域包无独立构建脚本：dev/构建都走 frontend 宿主（`frontend/scripts/build.ts` 打包 `main.tsx`，其相对导入 `../dsh/src` 由 Bun 解析）。⚠️ 实施时验证 `Bun.build` 对 dsh 内 `@/*`、`@innate/shared/*` 别名的解析（必要时 build.ts 补 tsconfig 注入）——T3 的验收项之一。
- CI：`typecheck` 增加 `cd dsh && bun run typecheck`；无需新增 install 步骤（根 `.npmrc` + `pnpm install` 覆盖新 workspace 成员）。
- deploy：`export-incremental.ts` 改调 `backend/src/dsh/export.ts`，`plugins.json` 产物路径不变（`frontend/public/data/plugins.json`），Pages 产物形态不变。

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `Bun.build` 解析 dsh 包内别名失败 | T3 先行验证；兜底：build.ts 注入合并后的 paths / dsh 内改相对导入 |
| 拆分后 feeds 域残留 dsh 引用（样式、路由树） | T3 验收含全仓 grep `dsh` 残留检查 + 全站手测 |
| 双域同 router 的类型噪音（TanStack 泛型） | 宿主组合处按官方示例 `as never`/`as unknown as` 收敛（web-domain.tsx 已有同款） |
| `shared/plugin-categories` 在 P3 gen 拷贝后解析失败 | 已知遗留（feeds 同样存在），P3 统一解决；本期不扩大 |

## 6. innate-fe 侧登记片段（P3 时用，非本期）

```yaml
# plugins.registry.yaml
profiles:
  feeds-dsh:
    domains:
      - id: feeds
        from: ../innate-feeds/frontend
      - id: dsh
        from: ../innate-feeds/dsh
    iframes: []
```

## 7. 验收口径

见各 task 文档（T1–T4）。总口径：功能零回退（API 响应逐字段等价、/dsh 四页可用、Pages 构建产物含 plugins.json）、`bun run typecheck` 三包通过、`bun test` 通过、CI 绿。
