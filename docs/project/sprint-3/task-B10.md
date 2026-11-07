# task-B10：UI/UX Design 主题域（数据收集 + 域包入驻「主题」组）

## 计划（开工前）

- 做什么：①数据收集：github-topics 采集配置新增 UI/UX 主题组（lift 分析选业务层 topic）并实跑同步落盘；②域包：`topics/ux-design/`（@innate/domain-ux-design）Hub 页（AIHot 富头部 + 主题药丸 + 索引网格），消费 topics 快照（API/静态双模式）；③宿主接线：main.tsx、build/dev 扫描目录、ICONS Palette、nav-visibility 放行 /ux。
- 功能点：①UI/UX Design 出现在「主题」组（Palette 图标）②10 个 topic 数据可持续采集（纳入日更）③Hub 三统计（快照数/新发现/已在 feeds）④双模式可用。
- 如何验证：同步输出各 topic count=50；/ux 200；bundle 含 UI/UX Design/Palette；typecheck/构建绿。

## 完成回填（完成后）

- 做了什么：`collectors/core/github-topics.ts` 增 `UX_DESIGN_TOPICS`（ui/ux/design/design-system/ui-components/component-library/figma/accessibility/tailwindcss/shadcn-ui）并入 DEFAULT_TOPICS 与 TOPIC_CATEGORIES「UI/UX Design」组；新建 `topics/ux-design/` 域包（package/plugin/tsconfig + web-domain + Hub 页，layout 用 Outlet 模式，路由返回 `layout.addChildren`）；宿主四处接线（域组合、Tailwind 扫描两处列表、ICONS+Palette、VISIBLE_PREFIXES /ux）。
- 完成的功能：①数据收集完成——7 个新 topic 实跑同步各 50 仓库（store merged 304），10 个 topic 全部纳入日更清单②Hub v1：富头部（kicker 主题 + 三统计 + fetched 日期）、10 主题药丸切换、四列索引卡（New 徽章 hot 色、★ 星数、in feeds 标记）③双模式取数（`VITE_STATIC_MODE` 切 /data 或 /api）。
- 验证证明：同步输出 7×count 50（本任务执行日志）；`/ux` 200；`__dev_main.js` 含 UI/UX Design/Palette ×4；`bun run typecheck` 全绿；VITE_STATIC_MODE 构建通过；`/api/topics/design-system` 返回 count 50/new 42/existing 8。提交 **5ed0739**。
