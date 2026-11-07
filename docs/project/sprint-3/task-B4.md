# task-B4：/trending 热点榜三层结构

## 计划（开工前）

- 做什么：/trending 套 AIHot 热点榜布局：NO.1 大卡（名称/描述/language/stars 徽章，走势位留结构）→ NO.2/3 中卡两列 → NO.4-10 行榜（rank-* 色阶行）；页尾「热度怎么算」折叠占位。
- 功能点：①三层信息层级 ②rank 色阶应用于 4-10 行与 NO.1/2/3 徽章 ③现有筛选（language/topic/搜索）保留 ④FeedCard 降级复用为行组件不删除。
- 如何验证：curl /trending 200；typecheck+build 绿；HTML 中可辨识三层结构（大卡/双卡/行列表类名）；筛选功能回归（带 language 参数 API 返回过滤结果）。

## 完成回填（完成后）

- 做了什么：新建 `components/hot-board.tsx`（NO.1 大卡含走势占位 / NO.2-3 中卡 / NO.4-10 行榜 / 「热度怎么算」details 折叠）；`feed-list-page.tsx` 增 `hotBoard` prop（前 10 进榜、余量 listItems 进原网格，空态判定同步，master-detail 与普通两渲染路径都插 board）；`trending/page.tsx` 开启 hotBoard。
- 完成的功能：①三层信息层级 + rank-1/2/3/rest 色阶 ②走势位与公式折叠为 M1 预留结构（占位文案明示）③FilterBar 筛选、分页、master-detail 点击、隐藏管道全部保留 ④FeedCard 未删除（网格余量与 starred 页继续用）。
- 验证证明：`/__dev_main.js` 含「热点榜/热度怎么算/NO.」×3；/trending 200；`curl :4000/api/feeds?type=trending&language=TypeScript` 全量命中 TypeScript（筛选回归）；VITE_STATIC_MODE 构建 + typecheck 绿。提交见下一行 docs 提交引用：**代码 commit 为本次 docs 提交的父提交**。
