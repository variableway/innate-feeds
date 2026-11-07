# task-B19：首页标题一行化 + AI Slop 主题呈现 + /trending 满屏

## 计划（开工前）

- 做什么：①首页头部「精选流 / Innate Feeds」合并为一行且不贴顶（原 kicker+h1 两行、`lg:pt-0` 导致桌面端贴顶）；②/ux 类目药丸「反 AI 味」更名「AI Slop」（用户反馈命名不够直白）；③首页主题区补第三张卡「AI Slop」（anti-slop/slop/ai-slop 三源合并 Top5）+ 网格升三列；④/trending 网格加密铺满宽屏（原 xl 封顶 3 列，宽屏右侧大量留白）。
- 功能点：①单行标题 + `pt-8 lg:pt-10` 顶部留白 ②AI Slop 药丸（与主页 Topic 索引 chips 同源 CATEGORY_TOPICS，自动同步）③主页 `loadSlopTop5()`（与 /ux 打分同构：SKILL 识别 + stars×5）④grid 升 `2xl:grid-cols-4`。
- 如何验证：dump-dom 主页（单行 h1、AI Slop 卡、chips）；/ux 药丸出「AI Slop」无「反 AI 味」残留；/trending DOM 含 2xl:grid-cols-4；合并逻辑 mock 数据单测；typecheck 绿。

## 完成回填（完成后）

- 做了什么：`home/page.tsx`——根容器加 `pt-8 lg:pt-10`，header 改单行 flex baseline（精选流 kicker 内联）；新增 `loadSlopTop5()`（三 topic 快照拉取→fullName 去重保最高星且 SKILL 标记跨实例合并→stars×(skill?5:1) 排序 Top5）；主题区网格 `md:grid-cols-2 lg:grid-cols-3`，新增第三张 TopicCard「AI Slop 反AI味 SKILL」（kicker 主题 · Anti AI，查看更多 → /ux）。`ux-design/pages/page.tsx`——CATEGORY_TOPICS `anti-slop` label 改「AI Slop」。`components/feed-list-page.tsx`——网格 `md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`。
- 完成的功能：①首页标题一行、离顶有距 ②/ux 与主页索引统一「AI Slop」命名 ③首页三张主题卡（EDU / UI-UX / AI Slop）④trending 宽屏四列铺满。
- 验证证明：dump-dom 主页——h1 为单行（`精选流</span><span>Innate Feeds`）、AI Slop 卡 ×1、`lg:grid-cols-3` 在列；API `/api/topics/{anti-slop,slop,ai-slop}` 各 50 items（top: taste-skill / impeccable / anti-slop）；合并逻辑 mock 单测（去重保最高星 120>100、SKILL 标记跨实例合并、加权 5000/4500/600 排序正确）；dump-dom /ux 出 `>AI Slop<` 且全文无「反 AI 味」；/trending DOM 含 `2xl:grid-cols-4`；typecheck 绿。首页三卡 dump 时均为骨架属 fetch 时序（与既有卡一致），逻辑经单测与 API 双验。
