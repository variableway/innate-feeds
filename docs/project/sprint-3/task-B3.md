# task-B3：主页改版：日分组时间轨精选流

## 计划（开工前）

- 做什么：`/` 由重定向改为真实主页：trending 数据按 snapshot_date 倒序日分组的 AIHot 精选流（sticky 日期头 + 卡片时间轨），顶部 PillTabs 切换 daily/weekly/monthly；空态用 EmptyState。
- 功能点：①/ 直接渲染（不再跳 /trending）②日分组 + 日期 sticky 头 ③period 切换 ④复用 B2 原语与 B1 token ⑤双模式可用。
- 如何验证：curl / 200 且 HTML 含日期分组结构；PillTabs 切换 period 后列表变化（API 参数）；typecheck + build 绿；静态模式 build:static 产物含主页。

## 完成回填（完成后）

- 做了什么：
- 完成的功能：
- 验证证明：
