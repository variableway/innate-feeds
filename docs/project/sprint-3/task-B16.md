# task-B16：主页双区块（3 天热榜合并 + 主题卡片）

## 计划（开工前）

- 做什么：主页重构为两部分。①「3 天 GitHub 热榜」：最近 3 个快照日的 trending 与 trendshift（daily 最近 3 期）合并去重，stars 排序，2 行网格分页（每页 8）；②「主题」：EDU 与 UI/UX Design 各一张卡，按域内打分列 Top 5，带「查看更多」跳转对应主题页。
- 功能点：①跨源合并（trending × trendshift）+ 去重（fullName，保留更新快照）②trendshift 命中卡 TS 徽章（含日增）③分页 ④主题卡 Top5（与各域打分同构）+ hot 徽章 + 查看更多 ⑤双模式可用。
- 如何验证：渲染 DOM（headless dump-dom）检查两区块、分页、徽章、零重复；typecheck/构建绿。

## 完成回填（完成后）

- 做了什么：重写 `frontend/src/pages/home/page.tsx`（425 行）：useHotPool（fetchDates 前 3 日 × fetchFeeds 各 50 + fetchTrendshiftSlice daily 取最近 3 期 → 双 Map 合并去重 → stars 排序）；loadEduTop5（external edu-skills，安装量×core 倍数）/ loadUxTop5（design-system/ui/ux 三快照合并，stars×SKILL 倍数）与各域打分同构；TopicCard 组件（Top5 行 + hot 徽章 + 查看更多 useNavigate）。
- 完成的功能：①热榜合并 72 仓库、9 页分页（每页 8，响应式 2/3/4 列）②TS 徽章 ×4（trendshift 命中卡显示日增）③主题双卡 Top5 + 跳转 ④双模式（API/静态路径分流）。
- 验证证明：dump-dom 渲染检查——「3 天 GitHub 热榜」「EDU 教育动画 SKILL」「UI/UX Design SKILL」均渲染、分页 1/9、查看更多 ×2、TS ×4、仓库名零重复；typecheck 绿（修一处 gained null 类型）；VITE_STATIC_MODE 构建通过。提交 **15dccb8**。
