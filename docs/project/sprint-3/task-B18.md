# task-B18：主页 Topic 索引 + 热榜查看更多 + 类目多源匹配 + 静态数据补齐

## 计划（开工前）

- 做什么：主页热榜区加「查看更多 → /trending」；主题区加 Topic 索引 chips（深链 /ux?tag=）；/ux 类目支持一类多源（反 AI 味 = anti-slop/slop/ai-slop 任一命中）；路由 validateSearch 支持 ?tag= 初始筛选；完整 build:static（含数据导出）补齐静态站 anti-slop 系列数据。
- 功能点：①热榜→trending、chips→ux 深链两个查看更多动线 ②多源类目修复「反 AI 味」漏匹配 ③静态站数据齐备。
- 如何验证：主页渲染（查看更多×3、chips×10、含反 AI 味）；深链 200；dist 含 anti-slop/slop/ai-slop/humanizer.json；typecheck 绿。

## 完成回填（完成后）

- 做了什么：`home/page.tsx` 热榜标题行加查看更多按钮（navigate /trending）、主题区下方 Topic 索引 10 chips（import 域导出的 CATEGORY_TOPICS，navigate /ux?tag=）；`ux-design/pages/page.tsx` 类目结构改 `{id,label,topics[]}`（反 AI 味三源、余单源）、过滤按任一命中、activeTag 初始读 URL ?tag=；`web-domain.tsx` 路由加 validateSearch；跑完整 `build:static`（此前 B17 只重建了前端未导出数据，静态站缺 anti-slop 系列是「页面上看不到」的原因之一——另一原因是浏览器未刷新，DOM 实测 /ux 前排已被 taste-skill/impeccable/humanizer 占据）。
- 完成的功能：①主页三个「查看更多」动线（热榜/EDU/UX）②Topic 索引一键深链筛选 ③「反 AI 味」类目覆盖三标签 ④静态站（Pages）数据补齐。
- 验证证明：dump-dom 主页——查看更多 ×3、Topic 索引 chips ×10、反 AI 味在列；`/ux?tag=anti-slop` 200；`ls dist/data/topics` 含 ai-slop/anti-slop/humanizer/slop.json；typecheck 四处绿。提交 **53eef74**（推送时遇 CI 快照并发，rebase 后推送）。
