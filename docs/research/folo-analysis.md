# Folo (RSSNext/Follow) Source Analysis

> 调研日期：2026-09-21。源码位于仓库根目录 `Folo/`（RSSNext/Folo，pnpm + Turbo monorepo，约 36MB）。
> 调研目标：① 完整分析 Folo 的模块 / 架构 / 主题系统；② 识别可借鉴到 innate-feeds（或个人 RSS 工具）的模块；③ 分析把 innate-feeds 数据转成 RSS 供 Folo 订阅的路线。
>
> 深入的工程拆解（各端技术栈对照、模块可移植性 P0–P3 分级、UIKit 语义色主题设计细节、AGPL 合规提示）见 [folo-deep-dive.md](./folo-deep-dive.md)。本文 §3 中「innate-feeds 主题在 `themes/linear.css`」的表述已过时，实际位于仓库根 `shared/themes/*` + `shared/theme-catalog.ts`。

## 0. 关键结论（先读这里）

1. **Folo 是纯客户端 monorepo**：feed 抓取、RSS/Atom 解析、去重全部在闭源后端 `api.follow.is` 完成，本仓库内没有任何 RSS 解析代码，客户端通过 `@follow-app/client-sdk`（catalog 锁 0.3.96）拉结构化数据。仓库中全仓搜不到 `fast-xml-parser` / `rss-parser` / `feed` 等解析依赖，仅有 OPML 解析（客户端）与 claim 用的 XML 格式化。
2. **两条使用路线互不冲突**：
   - **借鉴客户端**：渲染管线（rehype sanitize + 视图工厂）、readability 封装、UIKit 语义色主题、SQLite 增量同步——都可以较小成本移植进 innate-feeds 的 Bun + React 19 + Tailwind v4 + Hono 技术栈。
   - **输出 RSS 被 Folo 订阅**：只需产出标准 RSS/Atom feed URL，粘贴进 Folo Discover 即可订阅，完全不需要关心 Folo 内部数据结构。推荐静态导出方案（见 §5 方案 A）。

## 1. 总体架构：apps + packages

| 位置 | 是什么 | 技术栈 |
|---|---|---|
| `apps/desktop` | 主应用。Electron 三层（main/preload/renderer），renderer 同时就是 web 版（app.folo.is） | Electron + Vite + React 19 |
| `apps/mobile` | iOS/Android 客户端；`web-app/html-renderer` 是独立 Vite 微应用，装在 WebView 里渲染正文 | Expo 57 + RN 0.86 + NativeWind 4 |
| `apps/ssr` | 对外分享页（`/share/feeds|lists|users/:id`），自研 SSR + satori OG 图 | Fastify 5（Node）/ Hono（Cloudflare Worker） |
| `apps/cli` | 面向 AI agent 的 CLI（timeline/entry/feed/subscription/opml，json 输出） | commander + client-sdk |
| `apps/ota` | 自建 OTA 服务：GitHub Releases 为源，R2 存 `dist.tar.zst`，KV 存版本指针，cron 5 分钟同步 | Hono + Cloudflare Worker |
| `apps/landing` | 官网 | vinext（Vite 上的 Next 兼容框架，RSC） |
| `packages/internal` | 12 个共享子包：components / atoms / store / database / hooks / shared / constants / models / utils / logger / tracker / types | — |
| `packages/readability` | Mozilla readability 的工程化封装（fetch + chardet 编码检测 + DOMPurify + linkedom） | — |

其他单点：`api/vercel_webhook.ts` 是 Vercel 部署成功后清 Cloudflare CDN 缓存的 webhook（HMAC-SHA1 校验签名）。

### 1.1 desktop 三层结构

- **layer/main**（Electron 主进程）：`BootstrapManager.start()` 负责单实例锁、协议注册、热更新清理。IPC 用 `electron-ipc-decorator` 装饰器模式，`createServices([...])` 注册 9 个服务（App/Auth/Cli/Debug/Dock/Integration/Menu/Reader/Setting）。
- **preload**：`contextBridge` 暴露 `electron` / `api` / `platform`。
- **layer/renderer**（React 19 web 应用）：`ipcServices = createIpcProxy<IpcServices>(...)` 获得主进程服务的类型安全代理；Electron 下 API 请求经主进程 `auth.fetchWithAuth` 代理（绕 CORS/cookie）。

### 1.2 renderer 模块地图（`src/modules/` 共 40 个，核心如下）

三栏布局：`app-layout/MainDestopLayout.tsx` = 订阅树（`subscription-column`）+ 条目列表（`entry-column`，可调宽）+ 阅读区（`entry-content`），路由 `timeline/[timelineId]/[feedId]/[entryId]`。围绕它的模块：

`discover`（发现/添加订阅）、`rsshub`（路由字典浏览）、`renderer`（内容渲染器）、`entry-column` / `entry-content`、`player`（播客）、`ai-chat` / `ai-chat-session` / `ai-task`、`editor`（写文章）、`power` / `wallet`（积分）、`trending`、`list` / `claim`、`subscription-column`、`settings`（约 15 个设置页）、`panel`（Cmd-K/F/N 全局面板）、`spotlight`（图片墙）、`command`（命令面板）、`download`、`integration`、`new-user-guide` 等。

### 1.3 状态管理三层分工

- **Zustand（领域数据）**：`packages/internal/store` 按 12 个域分模块（feed/entry/subscription/unread/collection/inbox/list/user/action/image/summary/translation），每模块固定 `store.ts + hooks.ts + getter.ts + selectors.ts` 四件套。entry store 除数据外维护多个**索引**（`entryIdByView/ByCategory/ByFeed/ByInbox/ByList`），避免列表页全量过滤。经 `createZustandStore(name)` 创建（immer setter、shallow 比较）。
- **Jotai（UI 态）**：renderer `src/atoms/`（sidebar/preview/player/context-menu/popover/settings 等），`settings/*` 持久化到 localStorage。
- **TanStack Query（服务端态）**：自研 `defineQuery` 封装（key + invalidate + `optimisticUpdate` 用 immer 产 draft），`src/queries/` 按域组织；`useBizQuery.ts` 的 `useAuthQuery` 包登录态判断。

### 1.4 离线优先：本地数据库 + 同步引擎

- `packages/internal/database`：Drizzle + SQLite。桌面/web 用 **wa-sqlite + IDBMirrorVFS（IndexedDB 持久化）**，移动端 expo-sqlite，`ResourceLock` 串行化访问；40 个迁移 SQL。
- 表：feeds / subscriptions / inboxes / lists / unread（subscriptionId→count）/ users / **entries**（含 `readability_content`、`read`、media/attachments JSON 列）/ collections（收藏）/ summaries / translations（AI 摘要与翻译缓存）/ images（主色缓存）/ ai_chat_sessions / ai_chat_messages / **sync_transactions（本地 outbox，仿 Linear）** / sync_meta（lastSyncId 游标 KV）。
- 数据流：启动 `hydrateDatabaseToStore`（先 migrate）把本地库灌入 zustand → `sync/sync-engine.ts` + `transaction-queue.ts` 做增量同步 → invalidate TanStack Query。services 层（`src/services/`）提供 EntryService 等单例数据访问。

## 2. 内容渲染管线（最值得抄的部分）

一条 entry 的渲染链路：

1. **入口** `modules/renderer/html.tsx` 的 `EntryContentHTMLRenderer`：注入 URL 改写（相对路径基于 `feed.siteUrl`/`entry.url` 解析）、封面图、时间戳组件（`00:00` 文本渲染为可点击 TimeStamp，服务播客跳转）、图片右键菜单。
2. **解析**：`renderer/src/lib/parse-html.ts` + `packages/internal/utils/src/html.ts` —— unified/rehype 管线（`rehypeParse({fragment:true}) → rehypeSanitize(白名单扩展 video/iframe/figure/math/全套 SVG) → rehypeTrimEndBrElement → rehypeInferDescriptionMeta → stringify`），再经 `hast-util-to-jsx-runtime` 把 HTML 映射成 React 组件：`pre`→Shiki 代码高亮、`img`→块图/内联图按宽度分流（代理限宽 700）、`video`→Media 组件、`iframe`→沙箱化（仅白名单，YouTube 特判 referrerPolicy）、`math`→KaTeX、表格横向滚动、ShadowDOM 内 style 重写。
3. **安全双保险**：抓原文时 `packages/readability/src/sanitize.ts` 用 DOMPurify + JSDOM，`uponSanitizeElement` hook 只保留 YouTube embed iframe；渲染时 rehype-sanitize 白名单。
4. **readability 模式**：用户手动触发 `COMMAND_ID.entry.readability` → IPC 到主进程 `ipc/services/reader.ts` → `readability(baseUrl, {fetch: net.fetch 走代理})`（chardet 编码检测 + linkedom + `@mozilla/readability`，`keepClasses:true` 保留代码语言 class）→ 存 `entries.readability_content` 列。是「查看原文模式」，非默认路径。
5. **视图分发**：`FeedViewType`（All/Articles/SocialMedia/Pictures/Videos/Audios/Notifications，枚举来自 client-sdk）两层工厂——列表项 `entry-column/Items/getItemComponentByView.ts`（含 picture-masonry 瀑布流，骨架屏同构 `getSkeletonItemComponentByView.ts`）、详情 `entry-content/components/layouts/factory.ts` 的 `EntryContentLayoutFactory`。

值得注意的设计：HTML 安全与解析（rehype/hast）在跨平台共享包 `@follow/utils/html`，组件映射（Shiki/Media/ShadowDOM）留在桌面 renderer 层。

## 3. 主题系统

- **`tailwindcss-uikit-colors`**（RSSNext 发布的 npm 包，1.0.0，可直接装）：把 Apple macOS UIKit 语义色注册进 Tailwind。核心入口 `packages/configs/tailwindcss/web.ts` 的 `withUIKit()`，产出 `text-red`、`bg-fill-secondary`、`bg-material-thick`、`border-separator`、`text-secondary-label` 等工具类，底色是 CSS 变量（`--color-red` 为 RGB 三元组）；`ratio-mixing-plugin.js` 基于 color-mix 生成 `mix-*` 混色类。
- **暗色模式**：`darkMode: ["class", '[data-theme="dark"]']` 双选择器。切换在 `packages/internal/hooks/src/useSyncTheme.ts`（写 `documentElement.dataset.theme` + `disableTransition` 防闪烁）；Electron 版额外 IPC 同步原生标题栏外观。设置 UI 在 `modules/settings/tabs/appearance.tsx`（light/dark/system）。
- **Accent 颜色**：`--fo-a`（HSL）变量 + `ACCENT_COLOR_MAP` 8 预设（默认橙 `#FF5C00`）+ 自定义 hex（`getAccentColorValue`），同步进文章 ShadowDOM。
- **自有变量族 `--fo-*`**：`--fo-border`、`--fo-sidebar(-active)`、`--fo-item-active/hover`、`--fo-selection-*`、`--fo-text-primary`、`--fo-font-family` 等，按 `data-theme` 分组定义于 `packages/internal/components/assets/colors.css`。
- **磨砂**：macOS 走 Electron 原生 `vibrancy`（`manager/window.ts`），web 用 `bg-material-ultra-thin|thin|medium|thick|ultra-thick|opaque` + backdrop-blur（80px）兜底。
- **移动端**：`react-native-uikit-colors`（Nativewind + RN）与桌面端**不共享 token 文件但同源**——同一套 UIKit 语义色名（`text-red`、`bg-fill`）和字号体系（title1/headline/footnote）跨端一致；移动 html-renderer 直接复用桌面 `@follow/configs/tailwindcss/web` 配置。

对 innate-feeds 的意义：现有 `themes/linear.css`、`notion.css` 的思路正是 Folo「语义色 CSS 变量 + data-theme 切换 + accent 变量」的简化版，`tailwindcss-uikit-colors` 在 Tailwind v4 下可直接引入升级。

## 4. 可借鉴到 innate-feeds / 个人 RSS 工具的模块（按性价比排序）

| # | 模块 | 路径（相对 `Folo/`） | 怎么用 |
|---|---|---|---|
| 1 | rehype/hast HTML 安全渲染管线 | `packages/internal/utils/src/html.ts` + `apps/desktop/layer/renderer/src/lib/parse-html.ts` | digest 正文 / README 渲染若用 `dangerouslySetInnerHTML`，换成这套（sanitize + 组件映射）可同时解决 XSS 和代码高亮；Shiki/KaTeX 按需加 |
| 2 | FeedViewType 视图工厂 | `apps/desktop/layer/renderer/src/modules/entry-column/Items/getItemComponentByView.ts`、`entry-content/components/layouts/factory.ts` | trending/starred/digest/插件四类卡片统一成 view registry，新增数据源只注册一个 view |
| 3 | readability 封装 | `packages/readability`（chardet + DOMPurify + linkedom + @mozilla/readability） | 几乎可原样抄到 backend 做原文提取：digest issue 正文、starred repo 的博客链接全文，存进现有 SQLite |
| 4 | UIKit 语义色主题体系 | `tailwindcss-uikit-colors`（npm 直装）+ `--fo-*` 变量组织 | 升级现有 linear/notion 双主题为统一语义变量层，暗色切换只换 `data-theme` |
| 5 | Zustand 模块四件套 + 索引化 store | `packages/internal/store/src/modules/*` | frontend 从 useState/useEffect 演进时抄这个结构（domain store + selectors） |
| 6 | SQLite + lastSyncId 游标 + outbox 同步 | `packages/internal/database`、`packages/internal/store/src/sync/` | 契合现有 Hono+SQLite：静态 JSON 与本地库的增量同步、阅读/隐藏状态多端同步 |
| 7 | 持久化设置 atoms | `apps/desktop/layer/renderer/src/atoms/settings/*` | `usePersistedFeedFilters` 的成熟版：jotai + localStorage 带类型 |
| 8 | OPML 导入导出 | `apps/desktop/layer/renderer/src/modules/discover/DiscoverImport.tsx`、`modules/settings/tabs/data-control.tsx` | 做 RSS 工具的必备互操作，客户端解析实现可参考 |
| 9 | 三栏布局 + PanelSplitter | `apps/desktop/layer/renderer/src/modules/app-layout/`（内附 `LAYOUT_ARCHITECTURE.md`） | 列表+详情的桌面阅读布局 |
| 10 | img-proxy / lru-cache / url-builder | `packages/internal/utils` | README 图片代理防盗链、缓存 |

架构启发补充：`apps/cli` 用「json 输出 + skill.md」把自己暴露给 AI agent，与 backend 的 `cli.ts` 思路一致，可抄其命令组织；移动端「WebView 内嵌独立 Vite 微应用 + jotai 桥（`managers/webview-bridge.ts`）」是将来做 RN 壳的现成范式。

## 5. innate-feeds → RSS → 在 Folo 中阅读

Folo Discover 接受三种输入（`apps/desktop/layer/renderer/src/modules/discover/DiscoverForm.tsx`）：

- `https?://` — 标准 RSS/Atom/JSON Feed URL（后端解析）
- `folo://` — Folo 私有协议
- `rsshub://` — RSSHub 路由（支持绑定私有实例 + accessKey，`modules/rsshub/add-modal-content.tsx`）

只要 innate-feeds 产出合法 feed URL，粘进 Discover 即可订阅。官方扩展规范 "Folo-Flavored Feed Spec" 在 GitHub 线上 wiki（本地 `wiki/` 目录只有 i18n 文档），允许在 RSS/Atom 上加自定义元素控制 view / media / extra links。

### 方案 A：自己输出 RSS（推荐）

现有双模式架构两条路都通：

1. **API 模式**：Hono 加 `GET /rss/:type.xml`（trending/starred/digest），从 SQLite 查询生成 RSS 2.0 或 Atom，`Content-Type: application/rss+xml`。零新依赖（手写模板）或用 `feed` npm 包。
2. **静态模式（更适合）**：新增 `backend/src/data/export-rss.ts`，挂进现有 `data:sync:window → build:static` 流水线，输出到 `frontend/public/data/rss/*.xml`——GitHub Pages 天然可访问（`.nojekyll` 已有，xml 不受 Jekyll 影响），与现有 `export-incremental.ts` 并列成为第三个导出器。

Feed 设计要点（结合现有数据模型）：

- **按 type × period 分 channel**：`trending-daily / trending-weekly / starred / digest` 各一个 feed URL，每个 URL 在 Folo 里是一个独立订阅。
- **guid 稳定性**：trending 复合主键 `trending-{date}-{period}-{repoId}` 天然是理想 guid（`isPermaLink=false`）；starred 用 repo id。Folo 后端按 guid 去重增量——trending 每天快照产生新 guid = 每天新条目，语义正确。
- **字段映射**：`title` = `owner/repo ★stars · description`；`link` = repo URL；`pubDate` = snapshot date / `starred_at` / issue `createdAt`；`description` = repo description；digest 用 `content:encoded` 装 issue body HTML。
- **media 增强**：item 加 `<media:thumbnail>`（owner avatar / og image），Folo 的 Pictures/卡片视图可利用。
- **hidden 过滤**：导出 RSS 时套用现有 `data/hidden-store.ts`，与静态导出行为一致。
- **README 摘要**：已预取的 `readmes` 截前 N 段进 description，条目不点开就有内容。
- **视图选择**：trending/starred 订阅成 Articles 视图最合适。

优点：零新增部署、静态 Pages 即可被订阅、完全可控。缺点：更新频率受 cron 部署节奏限制（每天一次）；Folo 按 updatesPerWeek 自动调拉取频率，够用。

### 方案 B：写 RSSHub 私有路由

自建 RSSHub 实例（Docker），写自定义 namespace（如 `/innate/trending/:period`）读 GitHub Pages 上的公开 JSON chunks 或 API；Folo 绑定私有实例 + accessKey，以 `rsshub://innate/trending` 订阅。优点：路由参数化（period/language）、复用 RSSHub 生态；缺点：多运维一个服务。个人工具用方案 A 即可，除非本来就想跑 RSSHub。

### 方案 C：零代码——RSSHub transform/html 通用路由

Folo 内置支持 `rsshub://rsshub/transform/html/:url/:routeParams`，用 CSS 选择器把任意网页栏目变 RSS（`modules/discover/DiscoverTransform.tsx`）。可直接抓 GitHub Pages 页面。零开发，但选择器脆弱、拿不到 stars/topics 等结构化字段，且依赖公共 RSSHub 实例限额——只适合尝鲜验证。

### 方案对比

| | A. 自输出 RSS | B. RSSHub 私有路由 | C. transform/html |
|---|---|---|---|
| 开发量 | 小（一个导出器） | 中（JS 路由 + 自建实例） | 零 |
| 运维 | 无（静态 Pages） | RSSHub 实例 | 无 |
| 数据保真 | 高（全字段 + media） | 高 | 低（CSS 选择器） |
| 参数化订阅 | 每 channel 一个 URL | 路由参数 | 选择器参数 |
| 推荐度 | ★★★ | ★★ | ★ |

## 6. 落地建议（roadmap）

1. **短期（1 天）**：`backend/src/data/export-rss.ts`，输出 `trending-daily/weekly/monthly`、`starred`、`digest` 五个静态 feed 到 `frontend/public/data/rss/`，接入 `build:static` 流水线；可选加 Hono `/rss/:type.xml` 端点。
2. **中期**：借鉴 §4 的 1–4 号模块——rehype sanitize 管线（digest/README 渲染）、view registry、readability 原文提取、UIKit 语义色主题升级。
3. **长期**：借鉴 SQLite 增量同步（§1.4）做阅读/隐藏状态多端同步，innate-feeds 逐步长成「自产数据 + 自有 UI + 顺带对外供 RSS」的个人信息流闭环。
