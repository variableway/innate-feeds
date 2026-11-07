# task-B6：/edu 域 AIHot 卡片网格化

## 计划（开工前）

- 做什么：topics/edu-animate 域首页（skills 列表）换装为 AIHot 索引网格：响应式卡片网格（手机1列/lg 3列/xl 4列）+ PillTabs 分类筛选 + ink token 文字层次；域内逻辑不动。
- 功能点：①卡片网格 + 分类筛选换 AIHot 风格 ②域包自包含边界不破（不引 frontend 内部组件，token 经全局 CSS 生效）③categories/videos 页保持可用。
- 如何验证：curl /edu 200；typecheck（含 topics/edu-animate）绿；build 绿。

## 完成回填（完成后）

- 做了什么： 三文件——（rounded-card、title text-ink、路径/tagline/元信息 ink-3/4 层次、Core 徽章改 bg-hot）；（分类 select 移除，改为全部分类+各分类的药丸芯片行，active bg-ink；搜索/相关度/排序保留）；（网格 grid-cols-1/sm:2/lg:3/xl:4，计数 text-ink-4 tabular-nums）。
- 完成的功能：①AIHot 索引网格 + 药丸分类筛选 ②域包自包含边界不破（药丸为域内自绘，只消费宿主全局 CSS token，未 import frontend 内部组件）③videos/categories 页未动、照常可用。
- 验证证明：/__dev_main.js 含「全部分类/rounded-card/text-ink-3」×19；/edu、/edu/videos 均 200；bun run typecheck（含 edu-animate 包）绿；VITE_STATIC_MODE 构建通过。提交 **13aaf2d**。
