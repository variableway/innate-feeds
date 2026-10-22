# 分析：Datasource 与前端分离现状

> Issue: [variableway/innate-feeds#2](https://github.com/variableway/innate-feeds/issues/2) 步骤 1
> 日期：2026-10-22

## 结论

**已满足分离，可以进入迁移。** 数据源（backend）与前端在接口层完全解耦：前端只经 `services/` 层取数，支持无后端的静态模式独立运行。存在 3 处结构性耦合（类型未共享、`shared/` 非真包、基础 UI 内嵌前端），它们不阻塞分离判定，但要在迁移中一并处理。

## 判定依据

| 检查项 | 状态 | 证据 |
|---|---|---|
| 数据源独立可替换 | ✅ | `backend/` 含采集、SQLite、同步、静态导出，无 UI 依赖 |
| 前端不直连数据库/采集器 | ✅ | 页面只 import `services/` 与 `types/` |
| 接口契约成文 | ✅ | [feeds-api-v1](../project/spec/contracts/feeds-api-v1.md) |
| 无后端可运行 | ✅ | `VITE_STATIC_MODE=true` 走 `manifest.json` + chunks + `digest.json` |
| 双模式行为一致 | ✅ | `services/feeds.ts` 对 API / 静态返回同构 DTO |

## 数据流

```text
backend/                         frontend/
  collector/  ──►  SQLite  ──►  app/server.ts  ──/api/*──┐
  data/export ──►  public/data/*.json  ──/data/*──┐     │
                                                   ▼     ▼
                                            services/feeds.ts
                                            services/github-live.ts（浏览器直连 GitHub）
                                                   │
                                                   ▼
                                            types/feed.ts → pages/
```

- **API 模式**：`/api/feeds*` → Hono → SQLite（`bun:sqlite`）。
- **静态模式**：`manifest.json` 声明 chunks，前端合并去重；digest / README 仍可 live 直连 GitHub（快照 + 实时回退）。
- 两种模式在 `services/feeds.ts` 内切换（`IS_STATIC`），对页面返回同构 `FeedResponse` / `DigestResponse`。

## 耦合点（迁移中处理）

| # | 耦合 | 位置 | 影响 |
|---|---|---|---|
| 1 | DTO 类型两处各写一份 | `frontend/src/types/feed.ts` ↔ `backend/src/db/index.ts`（`FeedItemDTO` 等） | 字段漂移无编译期防护 |
| 2 | `shared/` 是路径别名而非 workspace 包 | `shared/theme-catalog.ts`、`plugin-categories.ts`；frontend tsconfig `paths` + backend 直引 | 两侧共用事实源但无版本/边界，`@innate/shared/*` 名不副实 |
| 3 | 基础 UI 内嵌前端 | `frontend/src/components/ui/`（60 个 shadcn 原语，约 10k 行）+ `app-sidebar.tsx` / `app-header.tsx` / `lib/theme.tsx` | 业务与壳层混装，无法作为 domain 复用 |

耦合点 1、2 是**跨层共享物未打包**；耦合点 3 是**壳与业务未分层**。三者都不影响「datasource 与前端分离」的判定（接口层已解耦），但决定了插件化改造的切口。

## 对迁移的含义

1. **datasource 不动。** backend 采集 / SQLite / 导出链路保持独立，本仓继续持有数据事实源。
2. **前端按「业务 domain」与「壳 UI」切开。** 业务（pages + services + types）可整体变成 domain；壳 UI（sidebar / header / 主题 / 原语库）按迁移方案剥离。
3. **类型与 `shared/` 收敛为可共享物**，供 domain 与 backend 共同引用，避免插件化后漂移。

下一步见 [innate-fe-plugin-migration.md](./innate-fe-plugin-migration.md)。
