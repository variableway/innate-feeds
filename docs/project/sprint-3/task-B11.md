# task-B11：edu 域精简——categories 页并入主页面，菜单改 EDU

## 计划（开工前）

- 做什么：移除 `/edu/categories` 路由与页面（分类浏览已由主页分类药丸承接）；删除主页指向 categories 的导航链接；菜单「Edu Animate」改「EDU」。
- 功能点：①/edu/categories 不再是独立页②分类浏览在 EDU 主页内完成（B6 药丸）③「主题」组内菜单名简化为 EDU。
- 如何验证：typecheck 绿；/edu 200；bundle 无 categories-page 引用、含 "EDU" 标签。

## 完成回填（完成后）

- 做了什么：`topics/edu-animate/src/web-domain.tsx` 删 categories 路由、categories-page import（sed 残留行二次清除）、navItems label `Edu Animate` → `EDU`；`pages/page.tsx` 删「分类」导航链接；`git rm pages/categories-page.tsx`。
- 完成的功能：①categories 独立页移除，分类浏览收敛到 EDU 主页药丸（B6 已建）②「主题」组菜单：EDU / EDU Videos / UI/UX Design。注：`/edu/categories` URL 返回 200 属 SPA 壳回退（任意未知路径同行为），客户端路由已不存在。
- 验证证明：`bun run typecheck` 全绿；/edu 200；bundle 含 `"EDU"`；categories-page 文件已删、import 清零（typecheck 保证）；静态构建通过。提交 **5ed0739**（与 B10 同提交）。
