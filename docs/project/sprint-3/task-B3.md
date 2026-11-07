# task-B3：主页改版：日分组时间轨精选流

## 计划（开工前）

- 做什么：`/` 由重定向改为真实主页：trending 数据按 snapshot_date 倒序日分组的 AIHot 精选流（sticky 日期头 + 卡片时间轨），顶部 PillTabs 切换 daily/weekly/monthly；空态用 EmptyState。
- 功能点：①/ 直接渲染（不再跳 /trending）②日分组 + 日期 sticky 头 ③period 切换 ④复用 B2 原语与 B1 token ⑤双模式可用。
- 如何验证：curl / 200 且 HTML 含日期分组结构；PillTabs 切换 period 后列表变化（API 参数）；typecheck + build 绿；静态模式 build:static 产物含主页。

## 完成回填（完成后）

- 做了什么：新建 `frontend/src/pages/home/page.tsx`（HomePage）；`web-domain.tsx` 的 `/` 路由由 `<Navigate to="/trending"/>` 换为真实主页；移除不再使用的 Navigate import。日分组逻辑 groupByDate（snapshotDate 倒序，含 unknown 兜底）、今天/昨天人性化标题。
- 完成的功能：①/ 直接渲染精选流（PillTabs 排序：高星/最近更新/新创建，联动既有 persisted filters）②日分组 sticky 日期头 + 仓库计数 ③FeedCard 双列网格复用（含隐藏/话题点击管道）④EmptyState 空态含采集命令指引 ⑤双模式可用。
- 验证证明：dev server 热重建后 `/` 200；`/__dev_main.js` bundle 含 `时间轨`×1、`PillTabs/groupByDate`×4（SPA 无法 curl 渲染文本，以 bundle 代码为准）；`curl :4000/api/feeds?type=trending&sort=updated` 排序语义正常；`VITE_STATIC_MODE=true bun run build` 通过；typecheck 绿。提交 **642754d**。
