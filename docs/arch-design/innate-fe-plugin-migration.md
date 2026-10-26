# 迁移方案：innate-feeds → innate-fe domain 插件（独立仓 + 插件能力）

> Issue: [variableway/innate-feeds#2](https://github.com/variableway/innate-feeds/issues/2) 步骤 2
> 日期：2026-10-22 · 状态：**P0–P2、P4 已实施**；P3（innate-fe 侧联调）待该仓配合
> 前置分析：[datasource-frontend-separation.md](./datasource-frontend-separation.md)（结论：分离已满足）

## 实施状态（2026-10-22）

| 阶段 | 状态 | 证据 |
|---|---|---|
| P0 | ✅ | `shared/` 收敛（非 `@innate` scope，tsconfig paths / 相对路径）；`packages/` 已删除——`@innate/*` 由 `innate-fe-cli install` 从基础仓发布 |
| P1 | ✅ | `frontend` 更名 `@innate/domain-feeds`；`src/index.ts` 导出 `webDomain`；`src/web-domain.tsx` 声明全部路由 + `navItems` / `homeTile` capability；`plugin.json`（`innate.plugin.v1`, `kind: domain`） |
| P2 | ✅ | 删除 `app-sidebar.tsx`、`app-header.tsx`、`lib/theme.tsx`、`pages/__root/`、全部 `route.tsx`；业务件改引 `@innate/ui/components/*` |
| P3 | ⏳ | 需 innate-fe 侧 `plugins.registry.yaml` 登记本仓并 `gen` 联调（见 §4） |
| P4 | ✅ | `src/main.tsx` 独立宿主 + `src/host-shell.tsx` 紧凑左栏（读 `navItems` capability）；`bun run typecheck` / `bun run test`（34）/ `frontend build` 全绿；CI/deploy 接 `innate-fe-cli install`；playwright 实测导航 |

**§6 待定项的落地选择：** Pages 产物走 host 最小宿主直出（§6-1 选 a）；`@innate/*` 依赖走 `innate-fe-cli install`（Verdaccio 私有源，§6-2 选 A）；插件态 `/api` 基址维持相对路径 + `VITE_STATIC_MODE`（§6-3）；~~dsh 并入 `feeds` domain（§6-4）~~ → **已再拆分（2026-10-26，sprint-2 / issue #13）**：dsh 独立为 `@innate/domain-dsh`（顶层 `dsh/`），datasource 抽离至 `backend/src/dsh/`，详见 [dsh-domain-split.md](./dsh-domain-split.md)；`DigestFiltersProvider` 进 `DomainLayout`（§6-5）。

**去壳的最终口径（2026-10-22 修订）：** domain 不携带 sidebar/header/主题——插件态由 innate-fe webshell 承担。**独立态保留紧凑左栏**（`host-shell.tsx`，w-40），仅 host 参与、不进 `domains/` 打包面，导航项与插件态同源（`navItems` capability）。

---

## 0. 约束（已决策）

| 决策 | 内容 |
|---|---|
| 仓关系 | **innate-feeds 保持独立仓**，不合并进 innate-fe；datasource / 采集 / 部署留在本仓 |
| 插件轨道 | **轨道 A（domain）**：TanStack 源码与壳同树、同路由器、同主题 |
| 壳 UI | **彻底去壳**：本仓前端不再自带 sidebar / header 壳；插件态由 innate-fe webshell 提供壳 |
| 本轮交付 | 仅分析 + 本方案文档，不改代码 |

## 1. 目标架构

```text
innate-feeds/（独立仓，本仓）
├── backend/                  # datasource：采集、SQLite、静态导出 —— 不动
├── shared/                   # plugin-categories、theme-catalog（非 @innate scope）
└── frontend/                 # @innate/domain-feeds
    ├── src/index.ts          # export { webDomain }  ← 插件硬条件
    ├── src/web-domain.tsx    # createWebDomain("feeds") 路由 + navItems/homeTile
    ├── src/domain-layout.tsx # 业务区布局（DigestFiltersProvider）
    ├── src/main.tsx          # 最小独立宿主（无 sidebar/header）
    ├── src/pages|components|services|types|hooks|lib/   # 业务
    └── plugin.json           # innate.plugin.v1，kind: "domain"

@innate/ui、@innate/web-domain  ← innate-fe-cli install 从基础仓发布（Verdaccio）

innate-fe/（独立仓，消费方）
└── plugins.registry.yaml     # from: ../innate-feeds/frontend（或 registry 版本）→ innate-fe-cli gen
```

**两条运行路径：**

| 路径 | 壳从哪来 | 用途 |
|---|---|---|
| 插件态（主） | innate-fe `shells/webshell` | 嵌入工作台；侧栏入口 / 首页 tile 由 domain capability 声明 |
| 独立态（辅） | 本仓 `src/host/` 最小宿主 | 本地开发、调试、CI；**无** sidebar/header 壳 |

## 2. 去壳清单（基础 UI → 不进 domain）

按 [分离分析](./datasource-frontend-separation.md) 耦合点 3，以下**移出 domain**：

| 现有物 | 处置 | 去向 |
|---|---|---|
| `components/app-sidebar.tsx`、`app-header.tsx` | 删除 | 壳职责归 innate-fe webshell；domain 只留 `nav` / `homeTile` capability 声明 |
| `components/ui/`（60 个 shadcn 原语，~10k 行） | 删除 | 改依赖 `@innate/ui`（innate-fe 全仓唯一 primitive 来源） |
| `lib/theme.tsx`、`themes/*.css`、`shared/theme-catalog.ts` 的主题选择 | 移出 domain | 主题归壳（`@innate/ui` ThemeSelector + token）；domain 不自带主题切换 |
| `pages/settings/`（主题/外观设置页） | 移出 domain | 壳的设置能力；本仓独立态若需要，由 host 自理 |
| `pages/__root/route.tsx` 的三栏布局 | 拆 | 布局归壳；domain 只提供自己路由段内的布局（如 master-detail） |

**保留进 domain：** `pages/trending` `pages/starred` `pages/digest` `pages/dsh`、`components/` 中业务件（FeedCard、FilterBar、DigestCard、RepoDetailPane、plugin-*）、`services/`、`types/`、`hooks/`（业务筛选/列表）、`lib/feed-filters-storage.ts`、`lib/utils.ts`（`cn`/格式化）。

> `utils.ts` 的 `cn` 与 `@innate/ui` 重叠时以后者为准，避免两套 className 合并策略。

## 3. Domain 契约映射（轨道 A 硬条件）

`innate-fe-cli gen` 的 `scanDomains` 只认两条，不满足直接跳过：

1. `package.json` 的 `name` 以 **`@innate/domain-`** 开头（id = 去掉前缀部分）→ 建议 `@innate/domain-feeds`
2. `src/index.ts` 存在且 **导出 `webDomain`**

映射关系（对照 innate-fe `examples/feed`）：

| 本仓现状 | domain 契约 |
|---|---|
| `router.tsx` 的 trending/starred/digest/dsh 路由段 | `createWebDomain("feeds").addRoute("app", factory)`，路由挂宿主 outlet；各页保留自己的 detail 子路由 |
| `AppSidebar` 的 navItems（GitHub / Digest / Plugins） | `.addCapability("nav", { label, path, icon, order, group })`——每个顶层入口一条 |
| 首页卡片（若有） | `.addCapability("homeTile", { title, description, path })` |
| `VITE_BASE_PATH` 子路径适配 | domain 内 `BASE_PATH` 常量（参照 `examples/feed/src/lib/base-path.ts`），独立态与插件态共用 |
| `pages/__root` 布局 | 拆成 domain 内 `DomainLayout`（仅业务区内栏），壳布局由宿主注入 |

`plugin.json`（`innate.plugin.v1`，`kind: "domain"`）与 `package.json` 三硬条件（name / main / src/index.ts）按 UC6 骨架照抄 `examples/feed`。

## 4. innate-fe-cli 接入（独立仓路径）

本仓不进 innate-fe workspace，走 **仓外 domain** 路径（UC5 私有源 / UC6 仓外）。**`packages/` 已删除**——`@innate/ui` / `@innate/web-domain` 由 `innate-fe-cli install` 从基础仓发布到本地 Verdaccio 并改写为版本号。

```bash
# 一次性接入（发布 @innate/* → 写 .npmrc → 改写 workspace:* → pnpm install）
export INNATE_FE_ROOT=/path/to/innate-fe   # 或 --root
bun run setup:innate
# = bun "$INNATE_FE_ROOT/innate-fe-cli/src/index.ts" install --dir frontend && cp frontend/.npmrc .npmrc

bun install          # 根 workspace（backend）
bun run typecheck && bun run test && bun run build
```

**插件态（innate-fe 侧）：**

```bash
# innate-fe 侧：plugins.registry.yaml 登记本仓（路径或 registry 版本）
# domains:
#   - id: feeds
#     from: ../innate-feeds/frontend        # 本地 sibling 检出；或 registry 版本号
# iframes: []

bun innate-fe-cli/src/index.ts gen --profile feeds   # copy 进 domains/ 打包面 + 写接缝
bun innate-fe-cli/src/index.ts dev --profile feeds   # 壳 + feeds domain
```

**依赖约定：**

| 包 | 提供方 | 消费方声明 |
|---|---|---|
| `@innate/ui` | 基础仓 `packages/ui`（`private: false`）→ install 发布到 Verdaccio | `frontend`: `workspace:*`（install 改写为 `^0.1.0`） |
| `@innate/web-domain` | 基础仓 `packages/web-domain` | 同上 |
| `plugin-categories` 等 | 本仓 `shared/`（非 `@innate` scope） | tsconfig paths / 相对路径 |

> **注意**：`shared/` 不得使用 `@innate/*` scope——`install` 的 `rewriteWorkspaceDeps` 对「`@innate/*` + `workspace:` 却不在基础仓发布集合」的依赖报 missing 并抛错。

## 5. 分阶段实施

| 阶段 | 内容 | 验收 |
|---|---|---|
| P0 | 决策依赖策略（§4 待定项）；`shared/` 收敛为真包（`@innate/shared` 或并入 domain types） | 两侧类型单一来源，`typecheck` 通过 |
| P1 | 前端切层：业务移入 `src/domain/`，壳 UI 移出；补 `web-domain.tsx` / `index.ts` / `plugin.json` | `scanDomains` 校验通过；`dev:standalone` 可跑业务页 |
| P2 | 去壳：删 `components/ui/`、`app-sidebar`、`app-header`、主题切换；业务件改用 `@innate/ui` | 无本地壳代码；`typecheck` + 现有页面功能回归 |
| P3 | innate-fe 侧登记 `plugins.registry.yaml` + `gen` 联调 | 壳侧栏出现 Feeds 入口；`/feeds/*` 路由与主题跟随壳 |
| P4 | 本仓独立态与 CI 收口（`dev:standalone`、`build:standalone`、Pages 产物见 §6） | CI 绿；文档更新 |

**不在本期范围：** backend 变更、sheet-display epic、多用户鉴权、iframe 轨道（轨道 B）。

## 6. 待定问题

| # | 问题 | 选项 | 倾向 |
|---|---|---|---|
| 1 | **GitHub Pages 静态站**去壳后如何出产物？现有 `build:static` 是带壳整站 | (a) host 最小宿主直出（无 sidebar，UX 降级）(b) 构建期用 innate-fe webshell 组装出站（耦合构建）(c) Pages 暂缓，先保插件态 | (a) 起步，(b) 可选 profile |
| 2 | `@innate/*` 依赖策略（§4） | A / B / C | A，短期可 B |
| 3 | `/api/*` 相对路径在插件态的基址 | domain 配 `apiBase` capability 或 env；静态态维持 `/data/` | env 注入 |
| 4 | `pages/dsh`（插件目录）是否也进 domain，还是单独 domain | 合入 `feeds` / 独立 `@innate/domain-dsh` | 先合入，体积大再拆 |
| 5 | Digest 的 `DigestFiltersProvider`（根级 context） | 移入 domain layout | 随 P1 切层处理 |

## 7. 风险

- **去壳后独立态 UX 下降**：本仓用户直觉是「一个完整站点」。§6-1 需在实施前定稿。
- **`@innate/ui` 版本漂移**：独立仓按版本号依赖，innate-fe 发版节奏影响本仓；锁定 minor + peer `web-domain`。
- **`gen` 的 copy 语义**：`from: ../innate-feeds/frontend` 会把源码拷进 innate-fe `domains/` 打包面——**双向不回写**，改 domain 仍回本仓改，再 `gen`。
