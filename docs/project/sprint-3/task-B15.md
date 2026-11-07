# task-B15：trending 跨日去重 + 配色加深 + edu/ux 页修整

## 计划（开工前）

- 做什么：①诊断并修复 /trending 的 11/06 展示异常 ②回应「颜色太淡」做对比度审查与加深 ③EDU 页头精简、分类 emoji 删除、Edu Categories 菜单残留清除、B 站样例 UP 移除 ④/ux 类目策展化 + 卡片 tags 可点击 ⑤验证静态模式（Pages）可用性。
- 功能点：①trending 默认视图按仓库去重（保留最新快照）②ink-3/4 等四 token 加深一档 ③edu/ux 页面文案与交互收敛 ④tag 点击筛选 ⑤静态构建/预检全绿。
- 如何验证：渲染 DOM（headless dump-dom）去重前后对比；对比度计算；静态 preview 全页 200。

## 完成回填（完成后）

- 做了什么：`use-feed-list.ts` trending 分支按 repo.fullName 去重（保留 snapshotDate 最新；显式 date 筛选时不去重）；`styles.css` 亮色 ink-3 #59656b→#465158、ink-4 #657176→#545f68、rank-rest→#5c6774、border/input→#d3dad5；edu 两页头改 kicker+h1、药丸去 emoji、Edu Categories navItem 清除、`BILIBILI_EDU_UPS` 移除影视飓风并重采（最新快照 0 条）；ux 页 FETCH_TOPICS/CATEGORY_TOPICS 拆分、activeTag 统一筛选（药丸与卡片 tag 共用、外来 tag 显示可移除 chip）、卡片 tag 按钮 stopPropagation、修复 TOPICS 残留引用导致的渲染崩溃（这正是「点击没反应」的原因之一）。
- 完成的功能：①/trending 重复卡片清零（claude-mem NO.9/NO.10 双现、impeccable 双卡已修，DOM 复检 owner/repo 重复为 0——剩余 github.com/owner 计数为同卡片头像+仓库链接的正常现象）②文字对比度提升（次要 6.0→8.1:1、元信息 5.0→6.5:1、行榜 4.6→5.8:1）③ux 卡片 tags 点击即筛 ④静态模式验证通过。
- 验证证明：dump-dom 修复前后对比（重复仓库名清零）；WCAG 对比度计算输出在案；`build:static` + preview（:4173）全页 200；`dist` 含 404.html/.nojekyll/manifest/topics/external 分片；空源（bilibili 0 条）不导出属 export-external 优雅降级（`!payload.items.length → continue`），策展真实 UP 后自动恢复。typecheck 全绿。提交 **b3d153f**。
