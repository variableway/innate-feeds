# task-B17：主页间距修复 + 反AI味主题接入

## 计划（开工前）

- 做什么：主页根容器内边距 px-1（约 4px）提升到最小 32px（px-8 sm:px-10 lg:px-12）；UX_DESIGN_TOPICS 加入 anti-slop / slop / ai-slop / humanizer 四个反AI味生态 topic 并实跑同步；/ux 页数据池与类目同步扩展。
- 功能点：①主页与 sidebar 最小间距 ≥32px（远超 2 倍要求）②新 topic 数据入库（预期高新发现率的 SKILL 生态）③/ux 类目新增「反 AI 味」「Humanizer」④日更自动覆盖。
- 如何验证：typecheck/构建绿；页面 200；bundle 含新类目；同步输出各 topic count/new。

## 完成回填（完成后）

- 做了什么：`home/page.tsx` 根容器 `px-1 → px-8 sm:px-10 lg:px-12`；`github-topics.ts` 的 UX_DESIGN_TOPICS 与 TOPIC_CATEGORIES 各加 4 项；`ux-design/pages/page.tsx` FETCH_TOPICS（14 个）与 CATEGORY_TOPICS（+「反 AI 味」「Humanizer」）。
- 完成的功能：①主页间距 32px 起 ②anti-slop / slop / ai-slop / humanizer 四源实跑各 50 条落盘，**新发现 48/49/50/48**（anti-slop SKILL 生态主体首次入库：hallmark/impeccable/humanizer 一类）③/ux 可按新类目筛选，SKILL 加权自动把它们顶上前排。
- 验证证明：`sync github-topics --topic anti-slop --topic slop --topic ai-slop --topic humanizer` 输出 count 50×4、new 48/49/50/48；/ux 与 / 均 200；`__dev_main.js` 含「反 AI 味 / humanizer」×3；typecheck 四处绿；VITE_STATIC_MODE 构建通过。提交 **89a49ee**。
