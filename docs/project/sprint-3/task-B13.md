# task-B13：EDU 打分 + /ux 过滤器与 Tags + 空态清理

## 计划（开工前）

- 做什么：①EDU 加权打分（对齐 /ux 模式）：score = 安装量（回退 stars）× (core?5:1)，默认排序 weighted.desc，卡片显示打分徽章；②/ux 增加过滤器（搜索 + 语言下拉 + 仅 SKILL 开关）与卡片 Tags chips（对齐 EDU 页形态）；③/edu/videos 空态长文案删除。
- 功能点：①EDU 与 /ux 打分同构、公式可解释（徽章 title）②/ux 过滤维度：关键词/语言/仅SKILL/主题 ③Tags 展示 repo.topics 前 3。
- 如何验证：typecheck/构建绿；bundle 含「仅 SKILL/加权分/eduScore」；/ux /edu /edu/videos 200。

## 完成回填（完成后）

- 做了什么：`services/edu.ts` 加 `eduScore()` helper 与 `weighted.desc` 排序（双模式共用路径）；`pages/page.tsx` 排序选项首位「加权分（core×5）↓」并为三处默认值；`skill-card.tsx` 打分徽章（hot 色，title 说明公式）；`topics/ux-design/src/pages/page.tsx` 加 query/lang/skillOnly 状态与过滤链、语言派生列表、过滤器行（搜索+语言+仅SKILL 开关）、卡片 Tags chips；`videos-page.tsx` 删空态长说明。
- 完成的功能：①EDU 默认按加权分排序且卡片可见「分 N」②/ux 具备与 EDU 对称的筛选形态 + SKILL 快速过滤③视频空态简洁。
- 验证证明：typecheck 全绿；`/__dev_main.js` 含「仅 SKILL / 加权分（core×5）/ eduScore」×4；/ux、/edu、/edu/videos 200；VITE_STATIC_MODE 构建通过。提交 **b103311**。
