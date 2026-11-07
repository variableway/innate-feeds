# task-B12：/ux 重构为 SKILL 加权视图 + edu 微调 + 全局 404

## 计划（开工前）

- 做什么：/ux 页从「单 topic 快照」重构为「合并 10 topic 去重 + SKILL 识别 ×5 加权排序」——主题本体是 UI/UX Design 的 AI SKILL 而非基础库；排序可切纯星数。附带：edu 主页顶部「教学视频/分类总览」链接移除、排序下拉与相关度同行；main.tsx 加全局 notFoundComponent（已删路由明确 404）。
- 功能点：①SKILL 识别启发式（名称/描述 \bskill\b + topics 生态标签）②加权分 = stars×(SKILL?5:1)，默认排序，可切纯星数 ③SKILL 卡片 hot 视觉与加权分展示 ④主题药丸降级为筛选 ⑤/edu/categories 访问显式 404。
- 如何验证：/ux /edu 200；bundle 含加权逻辑与 404；typecheck/构建绿；设计域 SKILL 抽查（design-system 50 中 4 个 skill 特征）。

## 完成回填（完成后）

- 做了什么：重写 `topics/ux-design/src/pages/page.tsx`（并行拉取 10 topic → fullName 去重 → detectSkill 启发式 → score=stars×5/1 → 排序切换 + topic 筛选）；`edu-animate` 主页删顶部 nav 链接、filter-bar 排序下拉并入相关度行；`frontend/src/main.tsx` rootRoute 加 notFoundComponent。
- 完成的功能：①SKILL 默认置顶（加权分展示在卡片上）②纯星数模式可切 ③去重统计（N 仓库 · 其中 SKILL M）④edu 页内导航简化、筛选一行化 ⑤未知/已删路径明确 404（回主页链接）。
- 验证证明：`/ux`、`/edu` 200；`__dev_main.js` 含「SKILL 加权/分类总览(移除后仍匹配到删除痕迹)/404 · 页面不存在」；typecheck 全绿；VITE_STATIC_MODE 构建通过；数据侧 design-system 快照 50 中 4 个 skill 特征（taste-skill 111k 星等，curl 实测）。提交 **cff33d2**。
