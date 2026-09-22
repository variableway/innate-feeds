# Folo 深度拆解：架构 / 技术栈 / 模块 / 主题

> 调研日期：2026-09-21。源码：仓库根目录 `Folo/`（RSSNext/Folo，pnpm@10.17.0 + Turborepo，AGPL-3.0-only）。
> 定位：本文是工程侧深度拆解，回答「Folo 怎么搭的、主题怎么设计的、哪些模块能拆出来塞进 innate-feeds」。
> 姊妹文档：[folo-analysis.md](./folo-analysis.md)（偏产品视角与「innate-feeds → RSS → 被 Folo 订阅」的路线对比），两者互补不重复。
>
> 所有结论均来自对源码的逐文件阅读（该目录未安装 `node_modules`，涉及私有包的能力均以 import 站点为证，并在文中标注为推断）。

---

## 0. 关键结论（先读这里）

1. **Folo 是一个「三端 + 六个附属应用 + 12 个共享包」的重型 monorepo**，但工程范式极其统一：平台差异靠**文件名后缀 + 构建期解析插件**解决，业务逻辑全部下沉到 `packages/internal/*`。
2. **共享包是源码直连（exports → `src/*.ts`），不产出构建物**。只有 `@follow/electron-main`（tsc）和 `packages/readability`（tsdown）需要 build。这让 `turbo.json` 薄到只有 8 个 task。
3. **主题系统的本质是「Apple UIKit 语义色 token 层 + `data-theme` 属性切换 + CSS 变量重写」**，不是「多套主题文件」。核心是 `tailwindcss-uikit-colors`（npm 可直装）产出的三段落 token 命名：`bg-fill-secondary` / `text-text-tertiary` / `bg-material-thick`。
4. **模块可移植性出乎意料地高**：`packages/internal/components/src` 下约 116 个 UI 文件中，**只有 2 个**引用了 app 级状态或路由（`atoms/route.ts`、`providers/stable-router-provider.tsx`）。真正的移植障碍不是代码结构，而是 ① UIKit token 体系、② **AGPL-3.0 许可证传染**。
5. 对 innate-feeds 而言，**性价比最高的三件事**：① 拷 `packages/internal/hooks` + `utils`（P0，几乎零改造）；② 借 Folo 的语义 token 分层重做 `shared/themes/*` 的命名体系（解决当前 10 个变体各自硬编码的问题）；③ 补上 FOUC 防护 + `useSyncTheme` 式运行时同步（当前 `index.html` 无内联脚本，首屏会闪）。

---

## 1. 仓库全景与技术栈

### 1.1 目录结构

```
Folo/
├── apps/
│   ├── desktop/            # Electron 主应用（renderer 同时就是 web 版 app.folo.is）
│   │   ├── layer/main/     # @follow/electron-main：主进程（IPC / updater / tray / proxy）
│   │   ├── layer/renderer/ # @follow/web：React 19 web 应用（主要业务代码在这里）
│   │   ├── configs/        # 三份 Vite 配置（共享基底 / electron-render / web）
│   │   └── plugins/vite/   # 自研插件：平台分文件解析、AST 变换、HMR
│   ├── mobile/             # Expo 57 + RN 0.86
│   │   ├── src/
│   │   ├── web-app/html-renderer/  # 独立 Vite 微应用，塞进 WebView 渲染正文
│   │   └── native/         # 自研原生模块
│   ├── ssr/                # 对外分享页 + satori OG 图（Fastify / Cloudflare Worker 双形态）
│   ├── landing/            # 官网（vinext = Vite 上的 Next 兼容 RSC 框架）
│   ├── cli/                # 面向 AI agent 的 CLI（commander + client-sdk）
│   └── ota/                # 自建 OTA 服务（Hono + Cloudflare Workers + R2 + KV + cron）
├── packages/
│   ├── internal/           # 12 个共享包：components/atoms/store/database/hooks/shared/
│   │                       #   constants/models/utils/logger/tracker/types
│   ├── configs/            # tailwindcss 预设 + tsconfig 预设
│   └── readability/        # Mozilla readability 工程化封装（唯一需要 tsdown 构建的包）
├── icons/mgc/              # MingCute 图标（版权方声明不可再分发）
└── locales/                # i18next 语言资源（en / ja / zh-CN / zh-TW / fr-FR）
```

### 1.2 构建与依赖治理

| 机制 | 证据 | 作用 |
|---|---|---|
| pnpm workspace + Turbo | `pnpm-workspace.yaml`、`turbo.json`、`packageManager: pnpm@10.17.0` | `layer/*`、`mobile/web-app` 都是独立工作区包 |
| `catalog:` 协议 | `pnpm-workspace.yaml#catalog`：`@follow-app/client-sdk: 0.3.96`、`tailwindcss-uikit-colors: 1.0.0`、`typescript: 6.0.3` | 全仓版本唯一来源 |
| `overrides` | react/react-dom 锁 `19.2.7`、`drizzle-orm: 0.45.2`、大量 `@nolyfill/*` 替换 | 跨端版本对齐 + 体积裁剪 |
| `patchedDependencies` | `@mozilla/readability`、`workbox-precaching`、`react-native-ios-utilities` 等 6 个 patch | 上游 bug 就地修 |
| 极薄的 Turbo 图 | `turbo.json` 共 8 个 task；`typecheck` 显式 `dependsOn: ["@follow/electron-main#build"]` | 只有主进程需要先构建 |
| git hooks | `simple-git-hooks` + `lint-staged`：eslint --fix + prettier；改 mobile 自动 bump build id；改 locales 自动去重 key | 提交期门禁 |

**共享包源码直连**（关键设计）：

```jsonc
// packages/internal/database/package.json
"exports": {
  "./*":          { "types": "./src/*.ts", "import": "./src/*.ts" },
  "./schemas/*":  { "types": "./src/schemas/*.ts", "import": "./src/schemas/*.ts" },
  "./services/*": { "types": "./src/services/*.ts", "import": "./src/services/*.ts" }
}
```

```jsonc
// packages/internal/components/package.json —— 连 CSS 都直接暴露源码
".": "./exports.ts", "./ui/*": "./src/ui/*", "./tailwind": "./assets/index.css"
```

收益：本地改共享包是源码级 HMR，无需 watch build；代价：所有消费方都必须能编译 TS 源码。

### 1.3 各端技术栈对照

| 能力 | desktop renderer（`@follow/web`） | mobile（`@follow/mobile`） | ssr（`@follow/ssr`） | landing |
|---|---|---|---|---|
| React | 19.2.7 | 19.2.7 + RN 0.86.0 + react-native-web | 19.2.7 | 19.2.7 |
| 路由 | react-router 8.2.0（hash/browser 双模）+ `vite-plugin-route-builder` 生成路由表 | **自研导航栈**（`src/lib/navigation/`，jotai 维护栈 + EventEmitter 广播；全仓无 expo-router/react-navigation） | react-router 8.2.0 + 自建 `src/router/{global,og}` | vinext（RSC） |
| 状态 | jotai 2.20.1（UI 态）+ zustand 5.0.14（领域态）+ TanStack Query 5.101.2（服务端态） | 同左三者 | jotai + Query | jotai + immer |
| 样式 | Tailwind **4.3.2** + UIKit 语义色 | NativeWind 4.2.6 + Tailwind **3.4.17** | Tailwind 4.3.2 + **daisyUI 5.6.16** | Tailwind 4.3.2（CSS-first，无 UIKit/daisyUI） |
| 动画 | motion 12.42.2（LazyMotion + `m.*`） | reanimated 4.5.1 | motion | motion + rough-notation |
| UI 原语 | Radix 全家桶 + headlessui + cmdk + sonner + embla + masonic + dnd-kit + xyflow | RN 原生族（flash-list / zeego / gorhom-portal / sheet-transitions） | Radix avatar + react-photo-view | `@base-ui/react` 1.6.0 + radix-ui + vaul |
| 富文本 | **Lexical 0.46**（自研 13 文件的 rich-editor） | 无（MarkdownNative / HtmlWeb） | — | — |
| Markdown | react-markdown 10.1.0 + remark/rehype 全链 + shiki | shiki（native） | xss 清洗 | react-markdown |
| 表单/校验 | react-hook-form 7.81.0 + zod 4.4.3 | 同左 | 同左 | — |
| i18n | i18next 26.3.5 + react-i18next（资源在仓库根 `locales/`） | 同左 | 同左 | next-intl |
| 数据 | Drizzle 0.45.2 + SQLite（wa-sqlite + IDBMirrorVFS） | expo-sqlite | 无本地库 | idb-keyval |
| 构建 | electron-vite 5 + electron-forge 7.11.2 + Vite 7.3.1 | Expo prebuild + Metro + EAS | Vite + tsdown + Fastify | vinext |
| 测试 | Vitest（co-locate `*.test.ts`）+ Playwright（web/electron e2e） | Vitest + Maestro | Vitest | Vitest |

### 1.4 平台分文件解析（贯穿全仓的核心约定）

```ts
// apps/desktop/plugins/vite/specific-import.ts
case "electron": priorities = [".electron", ".electron.ts", ..., ...sharedExts /* .desktop* */]
case "web":      priorities = [".web",      ".web.ts",      ..., ...sharedExts]
```

- Vite 侧：`createPlatformSpecificImportPlugin("web" | "electron")` 在 `enforce: "pre"` 阶段改写 `resolveId`。
- Metro 侧：`apps/mobile/metro.config.js` 的 `config.resolver.resolveRequest` 尝试同目录 `xxx.rn.ts`。
- 典型收益：`packages/internal/database/src/db.ts` **只是一个纯类型声明文件**，真实实现由 `db.desktop.ts`（wa-sqlite+IndexedDB）或 `db.rn.ts`（expo-sqlite）按平台命中 —— 调用方永远只 `import { db } from "@follow/database/db"`。

---

## 2. 架构：数据 / 状态 / 同步

### 2.1 状态三层分工（`packages/internal/AGENTS.md` 明文规定）

| 层 | 技术 | 位置 | 职责 |
|---|---|---|---|
| 领域态 | Zustand | `packages/internal/store/src/modules/*`（12 个域，每域 `store.ts + hooks.ts + getter.ts + selectors.ts` 四件套） | feed / entry / subscription / unread / collection / inbox / list / user / action / image / summary / translation |
| UI 态 | Jotai | `apps/desktop/layer/renderer/src/atoms/*`（sidebar / player / preview / popover / settings…） | 纯 UI，`settings/*` 持久化 |
| 服务端态 | TanStack Query | `src/queries/*`，`defineQuery` 自研封装（key + invalidate + `optimisticUpdate`） | 远端数据、缓存、失效 |

`entry` store 额外维护多个索引（`entryIdByView / ByCategory / ByFeed / ByInbox / ByList`），避免列表页全量过滤 —— 这是列表性能的关键设计。

### 2.2 本地优先数据层

- **Schema 域**（`packages/internal/database/src/schemas/index.ts`，40 个迁移 SQL）：`feeds / subscriptions / inboxes / lists / unread / users / entries / collections / summaries / translations / images / ai_chat_sessions / ai_chat_messages / sync_transactions / sync_meta`。
- **平台适配**：`db.desktop.ts` = `wa-sqlite`（WASM）+ `IDBMirrorVFS`（IndexedDB 持久化）+ `drizzle-orm/sqlite-proxy` + `ResourceLock` 串行化；`db.rn.ts` = `expo-sqlite`。
- **Service/Repository 模式**：每个实体一个 `class XxxServiceStatic implements Resetable` + 单例导出，语义方法（`upsertMany / patchMany / reset`），SQL 收敛在 service 内。`conflictUpdateAllExcept(table, ["id"])` 统一做 upsert。
- **迁移**：drizzle-kit 生成 SQL + `meta/_journal.json`，自研 `migrator.ts` 读 journal、比对 `__drizzle_migrations.created_at` 增量执行；RN 侧还做 `ALTER TABLE ... ADD COLUMN` 的幂等跳过（PRAGMA table_info 比对）。失败自愈：`migrateDB()` catch → `deleteDB()` → 重建。

### 2.3 同步引擎（注释自述「modelled on Linear's sync engine」）

`packages/internal/store/src/sync/` 两条轨道：

**下行（服务端 → 本地）**：`sync-engine.ts` 维护 `lastSyncId` 游标（存 `sync_meta` 表），`delta({ lastSyncId })` 分页拉取，`reset` 时回退 `bootstrap()`；关键常量：

```ts
const PULL_INTERVAL_MS = 60_000            // 轮询间隔（document.hidden 时跳过）
const ACK_PULL_DELAY_MS = 1500             // 服务端会隐藏 1s 内的新 action
const UNREAD_CALIBRATION_INTERVAL_MS = 60 * 60_000
const SUBSCRIPTIONS_CALIBRATION_INTERVAL_MS = 24 * 60 * 60_000
```

**上行（本地 → 服务端）**：`transaction-queue.ts` 是 outbox（写 `sync_transactions` 表）：

- `defineTransactionKind({ kind, apply, rollback, execute, batchKey, maxBatchSize, overlays, syncIdOf, ackGraceMs })` —— `apply` 必须幂等（重启会重放）。
- 乐观叠加：先 `apply` 再入队；`getOverlays()` 汇总 pending + 已确认未结算的 overlay；`rebaseUnreadCounts()` 把本地意图叠加到服务端确认值上。
- 错误分级：`401 → "pause"`（暂停队列）；`>=500` 或 `408/425/429` → 重试（`MAX_ATTEMPTS = 8`，指数退避到 60s）；其余 4xx → `"fail"` 并 `rollback`。
- 降级设计：`markUnavailableIfMissing()` 把 404 视为「服务端没有 sync 端点」，此后退回全量 refetch —— 老服务端不会让客户端白屏。

启动编排（`store/src/hydrate.ts`）：`initializeDB → migrateDB → 各域 hydrate → transactionQueue.restore() → syncEngine.start()`。

### 2.4 网络与鉴权

- 客户端唯一入口是私有 SDK `@follow-app/client-sdk@0.3.96`（`FollowClient` / `FollowAPIError`），**无法移植**。
- 三处 client 策略不同：Electron 主进程用 `electron.net.fetch`（走 Chromium 网络栈 → 自动跟随系统/PAC/SOCKS 代理）+ 手动拼 Cookie；renderer 同源时走 IPC 桥 `auth.fetchWithAuth`；SSR 从请求 cookie 解析 session token。
- 鉴权：better-auth（`createAuthClient` + 自定义插件：one-time-token / two-factor / stripe / magic-link / last-login-method）。

### 2.5 内容渲染管线（对 innate-feeds 价值最高的一块）

```
entry HTML
  → renderer/src/lib/parse-html.ts + @follow/utils/html.ts
      rehypeParse({fragment}) → rehypeSanitize(白名单含 video/iframe/figure/math/全套 SVG)
      → rehypeTrimEndBrElement → rehypeInferDescriptionMeta → stringify
  → hast-util-to-jsx-runtime 映射为 React 组件
      pre→Shiki / img→块图与内联图按宽度分流 / video→Media / iframe→沙箱白名单
      / math→KaTeX / table→横向滚动 / ShadowDOM 内 style 重写
```

安全是双保险：抓原文时 `packages/readability` 用 DOMPurify + JSDOM，渲染时再用 rehype-sanitize 白名单。

---

## 3. 模块组成与可拆解性

### 3.1 `packages/internal/*` 逐包评估

| 包 | 规模 | 职责 | 依赖耦合 | 可拆解性 |
|---|---|---|---|---|
| `hooks` | ~19 hook + optimistic 子目录 | 通用 React hooks 库 | react / usehooks-ts / es-toolkit（无 app 态） | **高（除 optimistic）** |
| `utils` | ~38 文件纯函数 | `cn` / `jotai` 封装 / scroller / color / cjk / link-parser… | 仅公开 npm 包；`package.json` 声明 **MIT** | **高** |
| `components` | ~116 UI 文件 + 4 common | 共享 UI 与 Focusable 键盘导航框架 | **仅 2 个文件引用 router/app 态** | **高（需 token 适配）** |
| `shared` | settings / bridge / event / spotlight / scroll-mark-read / review-prompt / language / auth / env.* | 跨端共享逻辑 | 纯函数部分零依赖；`auth.ts` 绑 better-auth+stripe | **中（拆纯函数）** |
| `database` | schemas(15 表) + 13 service + 40 迁移 + 双平台适配 | 本地优先数据层 | drizzle + wa-sqlite/expo-sqlite | **低（只有「模式」可借）** |
| `store` | ~70 文件（12 域 + hydrate + context + morph + sync） | 领域态 + 离线同步引擎 | 绑私有 SDK + 后端 schema | **低** |
| `atoms` | `helper/setting.ts` + `atoms/user.ts` | `createSettingAtom` 持久化设置工厂 | 绑付费等级 + user store | **中（剥离后可用）** |
| `constants` / `models` / `types` / `logger` / `tracker` | 1–8 文件 | 常量 / 领域模型 / 类型 / 日志 / 埋点 | 领域专属或近乎空实现 | **低** |

### 3.2 关键发现：UI 层几乎无业务耦合

对 `packages/internal/components/src` 做全量 import 图谱后：

- 引用 app 级状态/路由的只有 **2 个文件**：`atoms/route.ts`（jotai 路由镜像）、`providers/stable-router-provider.tsx`（react-router hooks）。
- 其余 UI 文件只依赖 `@follow/utils`(cn/tw) + Radix/headlessui/motion/masonic/sonner 等公开包。
- **真正的耦合点是设计 token**：组件里遍布 `bg-fill-tertiary`、`text-text-secondary`、`bg-material-ultra-thick`、`bg-accent`、`border-border`、`rounded-lg`，这些类名的来源不是本地 CSS，而是私有 npm 包 `tailwindcss-uikit-colors`（见 §4）。

### 3.3 值得单独点名的三个模块

**① `common/Focusable/*` —— 键盘导航框架（6 文件）**

- 分层 Context：`FocusableContext`（元素是否在焦点内）、`FocusTargetRefContext` / `FocusableContainerRefContext`（当前聚焦元素与容器 ref）、`FocusActionsContext`（DEV 高亮）、`GlobalFocusableContext`（jotai atom 存 `EnhanceSet<string>` 焦点作用域集合）。
- `Focusable` 渲染 `div[role=region][tabIndex=-1]`，`focusin` 时把 scope `append` 进全局集合，`focusout`（确认焦点真离开容器）时 `remove`。
- `hooks.ts` 提供 `useSetGlobalFocusableScope`（append/switch/remove，返回 `{original,new}` 快照）与 `useReplaceGlobalFocusableScope(...scopes)`（返回 `rollback()`）。
- 与快捷键联动：`ui/button/action-button.tsx` 用 `shortcutOnlyFocusWithIn`（仅焦点在 Focusable 内才触发）+ `shortcutScope`（按 scope 命中）实现「不同面板绑定同一快捷键互不冲突」。
- 依赖仅 jotai + `usehooks-ts` + `@follow/utils`（`EnhanceSet` / `jotaiStore`）→ **可整体移植**。

**② `components/src/constants/spring.ts` —— 三档弹簧动效预设（零依赖）**

```ts
const smoothPreset = { type: "spring", duration: 0.4, bounce: 0 }
const snappyPreset = { type: "spring", duration: 0.4, bounce: 0.15 }
const bouncyPreset = { type: "spring", duration: 0.4, bounce: 0.3 }
export { SpringClass as Spring } // Spring.presets.smooth / Spring.snappy(d, extraBounce)
```

**③ `utils/src/jotai.ts` 的 `createAtomHooks`** —— jotai `store + selectAtom + shallow` 的封装，可以把一个 primitive atom 拆出 `useValue / useSet / useSelector` 三件套。是 `createSettingAtom` 的基础。

---

## 4. 主题系统设计（重点）

### 4.1 设计哲学

Folo 的主题**不是「多套主题文件」**，而是：

> 一套 Apple UIKit 语义色 token（亮/暗自适应） + 一个 `data-theme="light|dark"` 属性 + 一个可运行时重写的 accent 变量。

在这套体系下，「换肤」只有两种粒度：**切换明暗**（`data-theme`）与**换强调色**（`--fo-a`）。没有「Linear 主题 / Notion 主题」这种整体变体概念 —— 这与 innate-feeds 当前的 10 变体方案是两条不同路线，见 §4.10。

### 4.2 Token 分类学与真实类名

命名规则：`--color-<family>-<level>` 变量 → `<prop>-<family>-<level>` 工具类（旁证见 `apps/landing/src/styles/pastel-theme-oklch.css` 里同族的 `--color-fill-secondary` / `--color-material-ultra-thick`）。

| 家族 | 类名（节选） | 语义 |
|---|---|---|
| System colors | `text-red` `bg-blue` `border-gray`…（red/orange/yellow/green/mint/teal/cyan/blue/indigo/purple/pink/brown/gray） | 系统语义色 |
| Fill | `bg-fill` `bg-fill-secondary` `bg-fill-tertiary` `bg-fill-quaternary` `bg-fill-quinary` `bg-fill-vibrant[-secondary]` + `border-fill*` | 填充层 |
| Text | `text-text` `text-text-secondary` `-tertiary` `-quaternary` `-quinary` `text-text-vibrant*` | 文本层级 |
| Material | `bg-material-ultra-thick` `thick` `medium` `thin` `ultra-thin` `opaque` | 毛玻璃材质 |
| Control | `bg-control-enabled` `bg-control-disabled` | 表单控件底 |
| Interface | `bg-menu` `bg-popover` `bg-titlebar` `bg-sidebar` `bg-selection-focused[-fill]` `bg-header-view` `bg-tooltip` `bg-under-window-background` | 界面容器 |

设计上的「冗余前缀」是刻意的：`bg-fill-secondary`（fill 家族）、`text-text-secondary`（text 家族）、`bg-material-thick`（material 家族）—— 一眼可辨语义层。`AGENTS.md` 专门强调「务必用对前缀」。

真实使用（证据）：

```ts
// packages/internal/components/src/ui/toast/styles.ts
description: tw`text-xs text-text-secondary leading-relaxed mt-1`,
cancelButton: tw`h-6 px-2.5 text-xs font-medium rounded-md
                 bg-fill-secondary text-text-secondary
                 hover:bg-fill-tertiary hover:text-text`,
closeButton:  tw`... bg-material-ultra-thick`,
```

### 4.3 Tailwind 配置装配

```ts
// packages/configs/tailwindcss/web.ts
import { withUIKit } from "tailwindcss-uikit-colors/macos"

const twConfig = {
  darkMode: ["class", '[data-theme="dark"]'],   // ← 双选择器：.dark 或 [data-theme="dark"]
  theme: { extend: {
    fontSize: { largeTitle: [...], title1: [...], ..., caption: ["0.625rem","0.8125rem"] },
    fontFamily: { theme: "var(--fo-font-family)" },
    colors: {
      // DaisyUI 5 占用了 --border 表示边框宽度，所以这里改名 --fo-border 规避
      border: "hsl(var(--fo-border) / <alpha-value>)",
      background: "hsl(var(--background) / <alpha-value>)",
      accent: "hsl(var(--fo-a) / <alpha-value>)",
      folo: "#FF5C00",
      theme: {
        item: { active: "var(--fo-item-active)", hover: "var(--fo-item-hover)" },
        selection: { active: "…", hover: "…", foreground: "…" },
        inactive: "hsl(var(--fo-inactive) / <alpha-value>)",
        disabled: "hsl(var(--fo-disabled) / <alpha-value>)",
        background: "var(--fo-background)",
      },
    },
    borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    backdropBlur: { background: "80px" },
  }},
  plugins: [
    iconsPlugin({ collections: { ...getIconCollections(["mingcute","simple-icons","logos"]),
                                 mgc: getCollections(path.resolve(workspaceRoot, "./icons/mgc")) } }),
    require("tailwindcss-animate"), require("@tailwindcss/container-queries"),
    require("@tailwindcss/typography"), require("tailwindcss-motion"),
    require("tailwindcss-safe-area"),
    require(resolve(__dirname, "./tailwind-extend.css")),  // .css 当插件加载（tw-css-plugin.js）
    ratioMixingPlugin({ baseColors: { background: "hsl(var(--background))", accent: "hsl(var(--fo-a))", ... } }),
  ],
}

export const extendConfig = (config) => {
  const result = merge({}, withUIKit(twConfig), config)   // app 配置覆盖共享配置
  if (config.plugins) result.plugins = [...twConfig.plugins, ...config.plugins]  // 插件数组显式拼接
  return result
}
```

三个可复用的技巧：
1. `merge({}, base, appConfig)` 让各 app 覆盖共享配置，但**插件数组必须显式拼接**，否则 app 一加插件就会丢掉共享插件。
2. `tw-css-plugin.js` 通过 `require.extensions['.css']` 让 `.css` 文件能被 `require()` 成 Tailwind 插件 —— 于是 `tailwind-extend.css` 里的 `@layer components/utilities`（`.shadow-perfect`、`.mask-b*`、`.kbd`、`.checkbox`、`.spring-soft`…）以插件形式共享。
3. `ratio-mixing-plugin.js` 用 `color-mix(in srgb, …)` 生成混色工具类：`.bg-mix-accent-70`（百分比混色）、`.bg-mix-accent-background-3-2`（比例混色）。

### 4.4 CSS 变量资产：同一套 token，两种切换通道

```
packages/internal/components/assets/
├── index.css        @import "./colors.css"; @import "./tailwind.css"; @import "./font.css";
│                    @import "tailwindcss-uikit-colors/macos/selector.css";
│                    → 以 "@follow/components/tailwind" 暴露
├── colors.css       --fo-* 品牌/语义变量，用 [data-theme="light|dark"] 属性选择器
├── colors-media.css 同一批变量，用 @media (prefers-color-scheme: dark)
├── tailwind.css     shadcn 风格 base（--radius、--background、--color-background、--fo-border）+ @layer base
└── font.css         16 条 @fontsource/sn-pro 声明（200–900 + italic）
```

```css
/* colors.css */
:root { --fo-selection-active: theme(colors.accent/90); --fo-selection-hover: theme(colors.accent/80); }
[data-theme="light"] {
  --fo-a: 21.6 100% 50%;          /* 品牌橙 #FF5C00 的 HSL 分量 */
  --fo-text-primary: 0 0% 10%;
  --fo-item-active: theme(colors.zinc.400/0.3);
  --fo-item-hover:  theme(colors.zinc.400/0.2);
  --fo-inactive: 0 0% 80%;  --fo-disabled: 0 0% 70%;
  --fo-background: theme(colors.background);
  --fo-sidebar: 240 4.8% 95.9%;  --fo-sidebar-active: 240 4.9% 83.9%;
}
[data-theme="dark"] {
  --fo-a: 21.6 100% 50%;
  --fo-text-primary: 0 0% 80%;
  --fo-item-active: theme(colors.neutral.600/0.4);
  --fo-item-hover:  theme(colors.neutral.700/0.3);
  --fo-inactive: 0 0% 50%;  --fo-disabled: 0 0% 35%;
  --fo-sidebar: 220 8.1% 14.5%;  --fo-sidebar-active: 198 31.3% 6.3%;
}
```

```css
/* colors-media.css —— 移动端 WebView 用同一批 token 的媒体查询版 */
:root { --fo-a: 21.6 100% 50%; }
@media (prefers-color-scheme: dark) { :root { --background: 0 0% 7.1%; ... } }
```

为什么需要两份？桌面/SSR 走 `[data-theme]` 属性；移动端因为 `Appearance.setColorScheme()` 会同时驱动 WebView 内的 `prefers-color-scheme`、状态栏与 UIKit 色变量，所以 WebView 里必须用媒体查询。**同一设计令牌、两种切换通道**，这是跨端主题一致性的关键。

### 4.5 暗色机制与防闪烁

**运行时同步**（`packages/internal/hooks/src/useSyncTheme.ts`）：

```ts
export const useSyncThemeWebApp = () => {
  const colorMode = useAtomValue(themeAtom)
  const systemIsDark = useDarkQuery()
  useLayoutEffect(() => {
    const real = colorMode === "system" ? (systemIsDark ? "dark" : "light") : colorMode
    document.documentElement.dataset.theme = real
    disableTransition(["[role=switch]>*"])()   // 切换瞬间插入 transition:none !important，下一帧移除
  }, [colorMode, systemIsDark])
}
```

`disableTransition()` 只放行 `[role=switch]>*`，让开关本身仍有动画，其余全站不抖 —— 是个很实用的细节。

**首屏防闪烁（FOUC）**：`apps/desktop/layer/renderer/index.html` 与 `apps/ssr/index.html` 都内联了同款脚本，在 React 挂载前直接读 localStorage 写 `dataset.theme`：

```js
function setTheme() {
  let e = "follow:color-mode", t = document.documentElement, a = localStorage.getItem(e)
  function h() { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" }
  if (!a) { t.dataset.theme = h() || "light"; return }
  switch ((a = JSON.parse(a))) {
    case "dark": t.dataset.theme = "dark"; break
    case "light": t.dataset.theme = "light"; break
    case "system": t.dataset.theme = h() || "light"
  }
}
```

桌面 `index.html` 里还内联了骨架屏样式（含亮暗两套 `--fo-sidebar` / `--background`），保证骨架屏也不闪白。

### 4.6 主题持久化与跨端同步

```ts
// packages/internal/hooks/src/internal/for-theme.ts
export type ColorMode = "light" | "dark" | "system"
export const useDarkQuery = () => useMediaQuery("(prefers-color-scheme: dark)")
export const themeAtom = !window.electron
  ? atomWithStorage(getStorageNS("color-mode"), "system" as ColorMode, undefined, { getOnInit: true })
  : atom("system" as ColorMode)   // Electron 不本地持久化，改由 IPC 读 OS 外观
```

| 端 | 持久化 | 生效机制 |
|---|---|---|
| desktop (web) | jotai `atomWithStorage` → `follow:color-mode` | `useSyncThemeWebApp` 写 `data-theme` |
| desktop (Electron) | OS 外观（IPC `setting.getAppearance/setAppearance`） | `useSyncThemeElectron` |
| ssr | 同 web | `RootProviders` 里挂 `useSyncThemeWebApp()` |
| mobile | UI setting `colorScheme`（默认 `system`） | `Appearance.setColorScheme()` |
| landing | 服务端渲染 `<div data-theme>` | Tailwind `@custom-variant dark` |

值得注意：**`colorScheme` 不在云端同步白名单内**（desktop 白名单只有 `uiFontFamily / readerFontFamily / opaqueSidebar / accentColor`），即主题是**设备本地偏好**，不同步 —— 这是刻意的产品决策，端之间明暗可能不一致。

### 4.7 强调色换肤（唯一真正的「换肤」能力）

```tsx
// apps/desktop/layer/renderer/src/providers/setting-sync.tsx
const isDark = useIsDark()
useInsertionEffect(() => {
  document.documentElement.style.setProperty(
    "--fo-a",
    hexToHslString(getAccentColorValue(setting.accentColor)[isDark ? "dark" : "light"]),
  )
}, [setting.accentColor, isDark])
```

```ts
// packages/internal/shared/src/settings/constants.ts
const ACCENT_COLOR_MAP = {
  orange: { light: "#FF6B35", dark: "#FF5C00" },
  blue:   { light: "#5CA9F2", dark: "#2F78E8" },
  green:  { light: "#4CD7A5", dark: "#1FA97A" },
  purple: { light: "#B07BEF", dark: "#8A3DCC" }, pink: …, red: …, yellow: …, gray: …,
} satisfies Record<string, { light: string; dark: string }>
export const getAccentColorValue = (color: AccentColor) => { /* 支持自定义 #hex */ }
```

`--fo-a` 被广泛用于玻璃拟态阴影叠层（`hsl(var(--fo-a) / 0.06~0.3)`），因此一次换色会连带改变所有 hover/glow 效果 —— 这是「一套变量驱动整体质感」的典型收益。

### 4.8 排版 / 圆角 / 模糊 / 动效 / 阴影

| 维度 | 设计 |
|---|---|
| 字号 | Apple 语义命名 `largeTitle/title1/title2/title3/headline/body/callout/subheadline/footnote/caption`（`web.ts`），移动端改用 `--text-*` 变量以支持字号缩放 |
| 根字号 | desktop 由设置驱动：`root.style.fontSize = setting.uiTextSize * (mobile ? 0.875 : 1) + "px"` |
| 圆角 | 全部由 `--radius`（0.5rem）派生 `lg/md/sm` |
| 模糊 | `backdropBlur.background = 80px` → `backdrop-blur-background`；macOS 另走 Electron 原生 `vibrancy` |
| 阴影 | `tailwind-extend.css` 定义 `.shadow-perfect*` / `.shadow-modal` / `.shadow-context-menu` / `.shadow-tooltip-*`，暗色下用 `[data-theme="dark"]` 覆盖 |
| 动效 | `spring.ts` 三档预设 + CSS `.easing-spring` / `.spring-soft`（`linear(...)` 缓动 1.157s）+ keyframes（`caret-blink` / `accordion-*` / `shimmer` / `radialPulse`…） |
| 降级 | `useReduceMotion()` 写 `documentElement.dataset.motionReduce`，Tailwind 侧注册变体 `addVariant("f-motion-reduce", '[data-motion-reduce="true"] &')` |
| 桌面独有 | 平台/布局变体 `macos` / `windows` / `left-column-hidden` / `macos-left-column-hidden`；`drag-region`、安全区 `--fo-window-padding-top`、`--fo-macos-traffic-light-width` |

### 4.9 各端主题差异对照

| 维度 | desktop | mobile | ssr | landing |
|---|---|---|---|---|
| Tailwind | v4.3.2 | v3.4.17 + NativeWind | v4.3.2 + daisyUI | v4.3.2 CSS-first |
| UIKit 色包 | `tailwindcss-uikit-colors/macos` | `react-native-uikit-colors/tailwind` | 同 desktop | **无**（Pastel 生成 `--color-*`） |
| `dark` 变体 | `["class", '[data-theme="dark"]']` | `class`（实际由 `Appearance` 驱动媒体查询） | `media` | `@custom-variant dark (&:where([data-theme='dark'], …))` |
| 变量通道 | `[data-theme]` | `@media (prefers-color-scheme)` | `[data-theme]` + `media` | `[data-theme]` + `@variant dark` |
| 字体 | SN Pro（`@fontsource/sn-pro`）+ `--fo-font-family` | 系统字体 + `--text-*` 缩放 | SN Pro | Geist（`next/font`） |
| 额外能力 | reduce-motion 变体、原生 vibrancy | 字号缩放 `FontScalingProvider` | daisyUI 主题变量 | `[data-contrast='low'\|'high']` 三档高对比 |

daisyUI 冲突细节：daisyUI 5 把 `--border` 用作边框**宽度**，所以 Folo 把边框**颜色**改名为 `--fo-border`（`web.ts` 有注释说明）—— 若要在 innate-feeds 引 daisyUI，这是必踩的坑。

### 4.10 与 innate-feeds 现状的映射与差距

**innate-feeds 的实际现状**（注意：根 `AGENTS.md` 写的 `frontend/src/themes/linear.css` 已过时，真实位置在仓库根的 `shared/`）：

```
shared/
├── fe-base-themes.css        @import "./themes/linear.css" 等 4 个
├── themes/
│   ├── linear.css            [data-theme="linear"] / .dark[data-theme="linear"]
│   ├── notion.css            [data-theme="notion"]
│   ├── shadcn-default.css    5 个变体（zinc/slate/stone/gray/neutral），hsl 数值
│   └── shadcn-studio.css     marshmallow / art-deco（额外覆盖字体）
└── theme-catalog.ts          10 个变体 + ColorMode + cookie/localStorage 持久化 + applyThemeToDocument
```

```ts
// shared/theme-catalog.ts
export type ThemeVariant = "dsh" | "linear" | "notion" | "shadcn-zinc" | … | "art-deco"
export function applyThemeToDocument(variant, colorMode): "light" | "dark" {
  const root = document.documentElement
  const resolved = resolveColorMode(colorMode)
  root.classList.toggle("dark", resolved === "dark")
  root.setAttribute("data-theme", variant === "dsh" ? "" : variant)
  return resolved
}
```

两套方案对比：

| 维度 | Folo | innate-feeds 现状 | 建议 |
|---|---|---|---|
| 主题粒度 | 明暗 + accent，**单一语义体系** | **10 个整体变体** + 明暗 | 保留多变体（这是 innate-feeds 的差异化优势），但把每个变体的变量收敛到 Folo 式**语义分层命名**（`--fill-secondary` / `--text-tertiary`），避免 5 个 shadcn 变体各自重复定义 |
| 切换机制 | `data-theme` 属性 + `.dark` 类（`darkMode: ["class", '[data-theme="dark"]']` 双选择器） | `data-theme` 属性 + `.dark` 类，`@custom-variant dark (&:is(.dark *))` | 机制已一致 ✅；可把 dark 变体补成双选择器以兼容 `[data-theme="dark"]` |
| 首屏防闪烁 | `index.html` 内联 `setTheme()` + 骨架屏样式 | **无内联脚本**（`index.html` 极简） | **建议补**，成本 ~15 行 |
| 运行时同步 | `useSyncThemeWebApp`：`useLayoutEffect` + `useMediaQuery` + `disableTransition` | `lib/theme.tsx` 的 4 个 effect（含跨标签 `storage` 监听） | 已具备，缺 `disableTransition` 防抖细节 |
| 持久化 | jotai `atomWithStorage`（单一 key） | cookie + localStorage + legacy key 三写 + 旧值迁移 | innate-feeds 更完善 ✅ |
| 换肤（accent） | 8 预设 + 自定义 hex → 运行时重写 `--fo-a` | 无 accent 维度（靠整体变体） | 可选：给每个变体加 accent 变量 |
| 毛玻璃/材质层 | `material-*` 6 档 + `backdrop-blur-background(80px)` | `.app-panel` 手写 `backdrop-filter: blur(8px)` | 可借 `material-*` 分层 |
| 交互控件 | `Segment` 分段控件、`PanelSplitter` 拖拽分隔 | 原生 `<select>` 切主题、`master-detail` 固定宽度 | 见 §5 |
| token 抽取约定 | 长 className 抽到同目录 `styles.ts`，用 `tw\`\`` 模板 | 无统一约定 | 建议采纳（不需要 AST 插件，普通字符串即可） |

---

## 5. 可移植性评估

### 5.1 P0：可直接移植（几乎零改造，建议优先）

| 模块 | 路径（相对 `Folo/`） | 说明 |
|---|---|---|
| hooks 库（除 optimistic） | `packages/internal/hooks/src/*` | `useControlled / useCountDown / useElementWidth / useInterval / useIsOnline / useLongPress / useMeasure / useOnce / usePageVisibility / usePrevious / useRefValue / useSetState / useSmoothScroll / useTitle / useTypescriptHappyCallback` 等，只依赖 react / usehooks-ts / es-toolkit |
| utils 纯函数 | `packages/internal/utils/src/*` | `jotai.ts`(createAtomHooks) / `scroller.ts` / `dom.ts` / `duration.ts` / `color.ts` / `lru-cache.ts` / `cjk.ts` / `data-structure/set.ts`(EnhanceSet) / `link-parser.ts`。**该包 package.json 声明 MIT** |
| common 基础件 | `packages/internal/components/src/common/{Fragment,ReparentPortal,MotionProvider,MemoedDangerousHTMLStyle}` | 纯 React + DOM |
| 弹簧预设 | `packages/internal/components/src/constants/spring.ts` | 零依赖 |
| 零依赖小件 | `ui/{divider,progressive-blur,skeleton,loading,progress,auto-resize-height,portal,z-index,shiny-text,kbd,json-highlighter}` | 仅需 token 改名 |
| 纯函数 | `packages/internal/shared/src/{queue,spotlight,scroll-mark-read,review-prompt,language}.ts` | 零依赖，`scroll-mark-read` / `review-prompt` 自带测试 |
| DB 互斥锁 | `packages/internal/database/src/ResourceLock.ts` | 零依赖 Promise 队列，bun:sqlite 写串行化同样适用 |
| 配置预设 | `packages/configs/tsconfig.extend.json`、`packages/configs/tailwindcss/{ratio-mixing-plugin.js,tw-css-plugin.js}` | 后者在 Tailwind v4 需验证 `require.extensions` 方式 |

### 5.2 P1：需改造后移植（价值最高的中间层）

| 模块 | 改造点 |
|---|---|
| `common/Focusable/*`（键盘导航框架） | 连带搬 `utils` 的 `EnhanceSet` + `jotaiStore`；DEV 高亮里的 `import.meta.env.DEV` Bun.build 可处理 |
| `ui/scroll-area/*` | 改成 shadcn token；`index.module.css` 的 CSS Module 在 Bun.build 支持有限，建议内联为全局 class 或任意值 |
| `ui/{tooltip,toast,segment,masonry,checkbox,switch,slider,tabs,table,select,popover,hover-card,context-menu,navigation-menu,form,radio-group,sheet,collapse,avatar,card,drop-zone,typography}`（约 60 文件） | 主要是 token 改名；`segment` 需引入 `use-context-selector`；`masonry` 需 `masonic` + 先移植 scroll-area；`toast` 需换 `i-mgc-*` 图标类；`datetime` 需去掉 i18next |
| `ui/button/{index,variants,action-button,interface}` | ① `tw\`\`` 模板标签换成普通字符串（否则需要 unplugin-ast，而 Bun.build 无等价体系）；② token 映射；③ ActionButton 依赖 Focusable 全套 |
| `atoms/src/helper/setting.ts`（`createSettingAtom`） | 剥离付费等级（`getSettingPaidLevel` / `canUpdatePaidSetting`）与 `useUserStore`，保留「`atomWithStorage` + `selectAtom` 缓存 + 变更事件派发」内核 |
| `shared/src/settings/{interface,defaults,constants}.ts` | 裁剪成 innate-feeds 自己的设置集；`hook.ts` 的 `hookEnhancedSettings` 是泛型组合器，可直接用 |
| `hooks/src/optimistic/*` | innate-feeds 无 react-query；`strategies.ts`（create/update/delete/toggle 四种策略）本身是纯逻辑，可单独抄 |
| `components/assets/{colors,tailwind}.css` + `configs/tailwind-extend.css` | `theme(colors.accent)` 旧语法要改成 `@theme` 变量或 `var(--…)`；作为「token 桥接层」，是搬 40+ UI 组件的前置条件 |
| `database/src/services/*` 的 Service 模式 | 模式值得抄（每实体一个单例 service + `conflictUpdateAllExcept` upsert + `Resetable`），实现需从 Drizzle 改写为 `bun:sqlite` prepared statement |
| `database/src/migrator.ts` 的迁移模式 | 只借「版本表 + 按 journal 增量执行 + ALTER 幂等跳过」思路 |

### 5.3 P2/P3：按需或不建议

- **不建议**：`packages/internal/store/**`（~70 文件，绑私有 SDK 与后端 schema）、`database/src/{schemas,drizzle,db.desktop,db.rn}`、`shared/src/{auth,auth-cookie,bridge,event,env.*}`、`tracker/constants/models/types/logger`。
- **平台专属，物理不可移植**：`apps/desktop/layer/main/**`（Electron）、`apps/mobile/**`（Expo/RN）、`apps/ota/**`（Cloudflare Worker）、`apps/ssr/**`、`apps/landing/**`（vinext）、`apps/cli/**`。
- **构建体系不匹配**：`apps/desktop/plugins/vite/{specific-import,ast,hmr}.ts` —— innate-feeds 用 Bun.build，无 Vite 插件体系与 AST 插件生态，只可借鉴「平台分文件」的思路（Bun.build 无 `resolveId` 钩子，需靠显式导入路径或构建期 define）。
- **私有 npm 包不可依赖**：`@follow-app/client-sdk`、`@folo-services/*`、`tailwindcss-uikit-colors`（后者虽在 npm 上，但 1.0.0 与内部约定耦合，谨慎引入）。

### 5.4 移植顺序建议

1. **底座**：`utils` + `hooks`（去 optimistic）+ `common/*` + `spring.ts` + `tsconfig.extend.json`。零风险，是一切的前置。
2. **token 桥接层**：把 Folo 的 `fill/text/material` 语义分层映射到 innate-feeds 现有的 shadcn `--*` token，并统一进 `shared/themes/*`。做完后 UI 组件可成批搬入 `frontend/src/components/ui/`。
3. **交互三件套**：`Focusable`（键盘导航）+ `scroll-area`/`masonry`（长列表）+ `tooltip`/`segment`/`PanelSplitter`（浮层与布局）。
4. **主题工程化**：补 FOUC 内联脚本 + `disableTransition` + `material-*` 分层 + accent 变量。
5. **状态层（可选）**：`createSettingAtom` 替代当前的 localStorage 筛选持久化。
6. **数据层（可选）**：只借 Service 模式与 `ResourceLock`，用 `bun:sqlite` 重写。

### 5.5 ⚠️ 许可证与合规（移植前必须先决策）

Folo 仓库根声明 `AGPL-3.0-only`（`packages/internal/*` 大多同此）。把源码拷进 innate-feeds 会使该项目受 **AGPL-3.0 传染**（含网络服务条款：对外提供服务需开放源码）。唯一例外是 `packages/internal/utils` 的 `package.json` 声明 `license: MIT`，但同仓库根为 AGPL，法务上仍建议整体按 AGPL 处理。

**两条可行路径**：
- **A. 接受 AGPL**：直接拷源码（当前 innate-feeds 若只自用/内部部署，影响可控）。
- **B. 不接受**：只「参考设计思路、独立重写」，不逐行拷贝；或仅使用 `@follow/utils`（MIT）与 npm 上的公开包（`tailwindcss-uikit-colors`）。

`Folo/icons/mgc/` 下的 MingCute 图标另有版权声明**不可再分发**，不要随代码一起拷。

---

## 6. 对 innate-feeds 的具体建议（结合现状缺口）

当前 innate-feeds 可以立即受益的清单（按「投入产出比」排序，均已在 §5 找到对应模块）：

| # | 缺口（来自代码清点） | 可借的 Folo 模块 | 落点 |
|---|---|---|---|
| 1 | **首屏主题闪烁**：`frontend/index.html` 无内联脚本 | `apps/ssr/index.html` 的 `setTheme()` + 骨架屏样式 | `frontend/index.html` |
| 2 | **长列表无虚拟化/瀑布流**：grid 与 fixed master-detail | `ui/masonry/*` + `ui/scroll-area/*` | `frontend/src/components/` |
| 3 | **无键盘导航**：仅 FeedCard 支持 Enter/Space | `common/Focusable/*`（scope + 快捷键联动） | 新增 `frontend/src/components/common/Focusable/` |
| 4 | **无命令面板**：`ui/command.tsx` 已 vendor 但未挂载 | Folo `modules/command/*` + `panel/*` 的组织方式（思路，非代码） | `frontend/src/components/` + 根布局 |
| 5 | **toast 不可见**：4 处调用 `sonner` 的 `toast` 但 `main.tsx` 未挂载 `<Toaster />` | —（修 bug，非移植） | `frontend/src/main.tsx` |
| 6 | **详情面板缺 iframe 预览**：文档承诺的 readme/iframe 切换未实现 | Folo 的 iframe 沙箱白名单 + ShadowDOM style 重写 | `repo-detail-pane.tsx` |
| 7 | **Markdown 渲染单薄**：`react-markdown + remark-gfm + rehype-sanitize` | `@follow/utils/html.ts` 的 rehype 管线 + hast→JSX（代码高亮/图表分流/KaTeX） | `frontend/src/components/markdown-body.tsx` |
| 8 | **无动效体系**：只有 `tw-animate-css` | `constants/spring.ts` 三档预设 + `MotionProvider` + reduce-motion 变体 | `frontend/src/lib/` |
| 9 | **主题切换控件原始**：原生 `<select>` | `ui/segment` + `ui/tooltip` | `app-header.tsx` |
| 10 | **vendor UI 零采用**：62 个 `ui/` 原语几乎全闲置 | Folo `components/assets/*.css` 的 token 分层 + `styles.ts` 抽取约定 | 全站 |
| 11 | **死代码**：`category-panel.tsx`、`stats-cards.tsx` 无引用 | —（清理，非移植） | 删除 |
| 12 | **前端零测试**：CI 只跑后端 5 个 Vitest | Folo 的 co-locate `*.test.ts` + Vitest 约定 | `frontend/` |
| 13 | **文档滞后实现**：overview/AGENTS 仍写 Vite 6 + better-sqlite3 + `frontend/src/themes/*` | —（顺手修正，非移植） | `docs/`、`AGENTS.md` |

同时要**明确不学**的部分：Folo 的三层状态（jotai+zustand+query）、增量同步引擎、service/repository 数据层，对当前「Hono + SQLite + 双模式（API/静态）」的规模而言都是过度设计 —— 除非 innate-feeds 未来要做多端离线与阅读状态同步。

---

## 附录：关键文件索引

**主题**
- 共享 Tailwind 配置：`Folo/packages/configs/tailwindcss/web.ts`、`tw-css-plugin.js`、`tailwind-extend.css`、`ratio-mixing-plugin.js`
- Token 资产：`Folo/packages/internal/components/assets/{index,colors,colors-media,tailwind,font}.css`
- 主题 hook：`Folo/packages/internal/hooks/src/{useDark,useSyncTheme}.ts`、`src/internal/for-theme.ts`
- 设置与色板：`Folo/packages/internal/shared/src/settings/{interface,defaults,constants,hook}.ts`
- 桌面：`apps/desktop/tailwind.config.ts`、`layer/renderer/index.html`、`src/providers/setting-sync.tsx`、`src/hooks/common/useSyncTheme.ts`、`src/styles/main.css`
- 移动：`apps/mobile/tailwind.config.ts`、`src/lib/color-scheme.ts`、`src/theme/*`、`src/providers/{index,FontScalingProvider}.tsx`、`src/spec/typography.ts`
- SSR / landing：`apps/ssr/tailwind.config.ts`、`apps/landing/src/styles/{globals,pastel-theme-oklch}.css`

**架构 / 数据**
- `Folo/package.json`、`pnpm-workspace.yaml`、`turbo.json`
- `packages/internal/database/src/{db.ts,db.desktop.ts,db.rn.ts,migrator.ts,ResourceLock.ts,schemas/index.ts,services/*}`
- `packages/internal/store/src/{hydrate.ts,sync/sync-engine.ts,sync/transaction-queue.ts}`
- `apps/desktop/{electron.vite.config.ts,configs/vite.*.ts,plugins/vite/specific-import.ts}`
- `apps/ota/src/{index.ts,routes/*,lib/*}`、`apps/ota/wrangler.jsonc`

**规范**
- `Folo/AGENTS.md`、`apps/desktop/AGENTS.md`、`apps/mobile/AGENTS.md`、`packages/internal/AGENTS.md`
- `Folo/.github/workflows/{lint,build-web,build-desktop,tag,publish-ota}.yml`
