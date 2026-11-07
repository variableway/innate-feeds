# 模块划分设计：可见面收缩与四向分离

> 状态：**已决策待执行**（用户拍板 2026-11-07）· 前置：M0 已合入
> 关联：[topic-platform-redesign.md](./topic-platform-redesign.md)（总案 M1-M4）、
> [frontend-backend-data-separation.md](./frontend-backend-data-separation.md)（S 系）

## 0. 目标与约束（用户拍板）

1. **可见模块只保留两个**：GitHub Trending、GitHub Starred。
2. **四个分离边界**：前台（host）／ 后端 API ／ 数据同步任务 ／ Topics。
3. 其余一切（digest、外部源 Feeds、trending-shift、topics、dsh、edu）降为**后台模块**：
   数据照常采集，导航不露出，URL 直达保留——「宽进全收，严出精选」的过渡形态。

## 1. 模块总览

| 模块 | 物理落点 | 职责 | 对外接口 | 边界禁令 |
|---|---|---|---|---|
| **M-Host 前台壳** | `frontend/src/`（host-shell / main / nav-visibility） | 壳（sidebar/theme）+ 域组合 + **可见性裁量** | 静态产物（Pages） | 不 import backend 任何文件；只经 `services/` 取数 |
| **M-Feeds 可见域** | `frontend/src/pages/{trending,starred}` + `services/feeds.ts` | 唯二可见页面 | — | 同上（双模式同构 DTO） |
| **M-API 后端服务** | `backend/src/app/`（server / admin-db / dsh/routes） | REST + 静态导出读取 | `/api/*`（shared 契约） | **不做采集编排**；不 import `collectors/`（现状已满足，保持） |
| **M-Sync 数据同步任务** | `backend/src/collectors/**` + `app/cli.ts`（sync 子命令）+ `data/export-*` | 采集、同步、导出 | CLI + cron 调度 | **不依赖 server 运行**；server 除手动触发端点外不调用 |
| **M-Topics** | `collectors/topics/`（新，见 §4）+ `data/topics-store.ts` + `export-topics.ts` + `/api/topics*` 路由段 + `frontend/src/pages/topics` + `services/topics` | Topics 纵切面（采集→存储→API→页面） | REST + JSON 分片 | 自包含；M2 Topic Hub 的直接底座 |
| **M-Shared 契约** | `shared/` | types / sources / 常量 | — | 三条禁令（既有，S0 起） |

```
         ┌────────── M-Host（壳 + 可见性） ──────────┐
         │  M-Feeds 可见域: /trending /starred      │ ← 唯二露出
         │  hidden(路由保留): digest feeds topics…  │
         └──────────────┬───────────────────────────┘
                        │ services（API/静态双模式）
         ┌──────────────┴──────────┐
         │ M-API  /api/*           │── 只读 ──▶ L0: SQLite + ~/.innate JSON
         └──────────────┬──────────┘                  ▲
                        │ (不调用)                     │ 写入
         ┌──────────────┴──────────┐                  │
         │ M-Sync  cli/cron 任务   │──────────────────┘
         │  trending·starred·digest·external·trendshift…
         │  M-Topics（第四组，独立纵切面）
         └─────────────────────────┘
```

## 2. 可见面收缩：host 侧过滤，不动域包

**机制**：新增 `frontend/src/nav-visibility.ts`（host concern）：

```ts
/** host 的可见性裁量：域包照常声明 navItems，host 决定露谁。 */
export const VISIBLE_NAV_PATHS = new Set(["/trending", "/starred", "/admin"]);
// /admin 为开发工具保留；其余全部 hidden（路由保留，URL 直达）
```

`HostShell` 的 `navItemsOf(domains)` 聚合后按此过滤。

**为什么不改 `@innate/web-domain` 的 NavItem 加 visibility 字段**：那是 base 仓的
包，加字段要发版；且可见性本来就是 host 的裁量（本仓既有哲学：host-shell.tsx
注释「host concern, not in domain」）。M2 落地 `curation/visibility.ts`（源可见性
唯一定义）后，host 配置退化为消费方。

**初始 hidden 清单**（对应现 navItems 14 项）：trending-shift、topics、digest、
feeds（含 10 个外部子源）、dsh 域、edu 域。

## 3. M-Sync：数据同步任务模块

**Jobs 清单**（入口统一为 `cli sync *`）：

| Job | 命令 | 产出 | 调度 |
|---|---|---|---|
| trending-daily | `sync:daily` | SQLite | local-daily / CI |
| starred-recent | `sync:starred:recent` | SQLite | local-daily |
| digest | `sync:digest --days 90` | `~/.innate/digest` | local-daily / CI |
| topics | `sync:topics` | topics store | local-daily / CI |
| external | `sync vc --source …`（8 源） | `~/.innate/{源}` | local-daily |
| trendshift | `sync:trendshift` | `~/.innate/trendshift` | 手动/按需 |
| awesome-dsh | `sync:awesome-dsh` | 本地 catalog | CI |
| window（全量） | `sync window --days 90` | SQLite + 静态导出 | Pages CI cron |
| **local-daily** | `data:update:local` | 编排上述前 5 项 | Orca 每日 |

**边界**：M-Sync 与 M-API 只共享 L0 读写层；`server.ts` 不 import `collectors/`
（现状已如此，写入禁令固化）；`POST /api/feeds/sync` 保留为手动触发例外并注释。
M1 的 curation 管道将挂 local-daily 尾部，互不冲突。

## 4. M-Topics：独立第四组

- **现状**：采集在 `collectors/core/github-topics.ts`（M0 按「GitHub 系」归组），
  存储在 `data/topics-store.ts`，API 为 `/api/topics*` 三条路由，前端有完整页面组。
- **动作**：`collectors/` 增第四组 **`topics/`**（`github-topics.ts` + 其测试移入），
  与 core/external/vertical 并列。语义：core/external/vertical 是按**采集性质**分组，
  topics 是**横向检索机制**，独立成组后语义更真，也为 M2 Topic Hub 让出干净的底座。
- `server.ts` 的 `/api/topics*` 路由段加归属注释；未来可抽 sub-app
  （`dsh/routes.ts` 模式），本轮不抽。
- 前端 topics 页面组：nav hidden，路由保留；`topic-discovery` skill 的 CLI 接口不变。

## 5. 迁移步骤（每步独立可验证，合计 ≈1.25 天）

| 步 | 内容 | 量级 | 验证 |
|---|---|---|---|
| S1 | `nav-visibility.ts` + HostShell 过滤 + hidden 页路由保留确认 | 0.5 天 | 导航仅 Trending/Starred/SQLite；hidden URL 直达 200 |
| S2 | `collectors/topics/` 第四组（git mv + import + 测试随移） | 0.25 天 | typecheck + bun test 绿 |
| S3 | server 路由段归属注释 + cli 帮助文本按模块分组 | 0.25 天 | review |
| S4 | AGENTS.md 写入四向边界禁令 + 模块表 | 0.25 天 | grep 校验禁令 |
| S5 | 验收：双模式构建 + 导航断言 | — | 全绿 |

## 6. 验收标准

1. 侧栏导航仅 Trending / Starred（+ Admin 工具项）；hidden 页面 URL 直达可用、
   其数据管道照常运行（local-daily 不变）。
2. 四向边界可 grep：`server.ts` 无 `collectors/` import；`frontend/src` 无
   `backend/` import；`collectors/topics/` 独立成组。
3. 双模式构建绿（API + `build:static`）；topics 采集→API→页面链路绿。
4. M1 热度引擎可无缝在其上继续（curation 挂 local-daily 尾部）。

## 7. 与总案的关系

本设计 = 总案 **M2 T2-5（visibility 标记）的最小提前版** + M0 三组分类的微调
（topics 第四组）。不改变 M1-M4 排期；M1 仍是下一主任务，本设计的 S1-S5 可先行
（约 1 天），因其只动边界与可见性，不动数据管道。
