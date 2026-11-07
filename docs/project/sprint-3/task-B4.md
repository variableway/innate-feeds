# task-B4：/trending 热点榜三层结构

## 计划（开工前）

- 做什么：/trending 套 AIHot 热点榜布局：NO.1 大卡（名称/描述/language/stars 徽章，走势位留结构）→ NO.2/3 中卡两列 → NO.4-10 行榜（rank-* 色阶行）；页尾「热度怎么算」折叠占位。
- 功能点：①三层信息层级 ②rank 色阶应用于 4-10 行与 NO.1/2/3 徽章 ③现有筛选（language/topic/搜索）保留 ④FeedCard 降级复用为行组件不删除。
- 如何验证：curl /trending 200；typecheck+build 绿；HTML 中可辨识三层结构（大卡/双卡/行列表类名）；筛选功能回归（带 language 参数 API 返回过滤结果）。

## 完成回填（完成后）

- 做了什么：
- 完成的功能：
- 验证证明：
