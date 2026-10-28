# Issue: trendshift-integration

**Status:** done（P0+P1；P2/P3 转后续任务）  
**Source:** [variableway/innate-feeds#23 trending shift integration](https://github.com/variableway/innate-feeds/issues/23)  
**Opened:** 2026-10-28 · **Assignee:** —  
**Feature:** —（集成分析 + 落地，见方案文档）

## 背景

Issue #23 要求集成 [quantavil/trendshift](https://github.com/quantavil/trendshift)（trending 历史数据流水线，AGPL-3.0）与 [quantavil/gitradar](https://github.com/quantavil/gitradar)（分诊式发现前端，MIT）：**先 clone 到 `reference/` 目录分析，再确认如何集成**。

## 交付物

- [x] `reference/trendshift/`、`reference/gitradar/`（shallow clone，已 gitignore）
- [x] [trendshift-gitradar-integration.md](../../arch-design/trendshift-gitradar-integration.md) — 两仓分析 + 差距对照 + 集成方案选项 + 许可红线
- [x] **已确认集成方案**：数据层 A+B（CDN 主源 + TS 抓取器备源）+ UI 层 1（概念移植 React），本轮 P0+P1
- [x] P0：`backend/src/collector/trendshift.ts`（双源采集/归一化/合并）+ `sync trendshift` CLI + `/api/trendshift*` + 静态导出 `data/export-trendshift.ts`（16 单测）
- [x] P1：`/trending-shift` 视图（timeframe tabs + 期次归档渐进加载 + stars_gained 增量条 + 语言切片/搜索/排序 + 社交徽章），API/静态双模式 + CDN 兜底
- [ ] P2：Save/Dismiss/Undo 分诊 + 键盘导航（后续）
- [ ] P3（可选）：滑手势 / JSON 备份导出（后续）

## 关键结论

- trendshift 的静态 JSON API（CORS 开放）可直接作为数据源，**不引入 AGPL 代码**；TS 抓取器为干净室重写（`parseInitialData` RSC flight 解析）；
- gitradar 为 MIT，纯逻辑概念已移植，UI 以 Tailwind/shadcn 风格重写；
- 本仓补齐缺口：trending 历史归档、`stars_gained` 增量、语言分榜、社交信号展示。

## 结论

分析→确认→P0/P1 落地完成（类型检查/57 测试/浏览器实测全绿）。P2/P3 需要时另开 issue。详见 [方案文档](../../arch-design/trendshift-gitradar-integration.md)。
