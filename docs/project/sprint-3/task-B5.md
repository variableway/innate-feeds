# task-B5：/trending-shift 行榜换装

## 计划（开工前）

- 做什么：/trending-shift 页用 rank-* 色阶 + ink token 换装为 AIHot 行榜风格（NO.1 头卡 + 行列表），保持现有 timeframe/language 筛选与数据逻辑不变。
- 功能点：①行榜视觉统一到 AIHot token ②NO.1 头卡 ③功能零变化（筛选/分页不动）。
- 如何验证：curl /trending-shift 200；typecheck+build 绿；页面类名含 rank token 引用。

## 完成回填（完成后）

- 做了什么：`frontend/src/components/trendshift-list.tsx` 的 TrendshiftRow 重构：行号按排名上 rank-1/2/3/rest 色阶；rank===1 渲染头卡变体（border-hot/30 + bg-hot-soft + "NO.1 · " 前缀 + text-ink 标题 + hot/15 走势条）；名称链接 text-ink-2/ink 层次。
- 完成的功能：①行榜视觉统一到 AIHot token ②NO.1 头卡强调 ③timeframe/language 筛选、走势条、标签 chips、外链行为零变化。
- 验证证明：`/__dev_main.js` 含 rank 色阶/NO.1 代码 ×3；/trending-shift 200；typecheck 绿；VITE_STATIC_MODE 构建通过。提交 **68e43c2**。
