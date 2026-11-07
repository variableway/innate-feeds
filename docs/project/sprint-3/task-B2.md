# task-B2：布局原语：ReadingLayout / EmptyState / PillTabs

## 计划（开工前）

- 做什么：新建 `frontend/src/components/layout/`：ReadingLayout（单栏+右侧栏 grid，AIHot Page.tsx:12 结构）、EmptyState（标题+说明+action）、PillTabs（药丸筛选芯片，基于 shadcn Tabs 或自绘按钮组）。
- 功能点：①纯展示组件，无业务依赖 ②三个原语均可被后续 B3-B6 复用 ③TS 严格类型。
- 如何验证：typecheck 绿；B3 起实际消费；为原语写一个最小 demo 路由或直接由 B3 消费验证（本任务以编译 + 被消费为准）。

## 完成回填（完成后）

- 做了什么：新建 `frontend/src/components/layout/`：`reading-layout.tsx`（AIHot Page.tsx:12 的单栏+右侧栏 grid，side: 断点对应 lg:）、`empty-state.tsx`（标题+text-ink-4 说明+action）、`pill-tabs.tsx`（泛型受控药丸组件，激活态 bg-ink，可选 count 徽标）+ `index.ts` barrel。
- 完成的功能：三个纯展示原语可直接被 B3-B6 消费；TS 严格类型（PillTabs 泛型约束 T extends string）；零业务依赖、零 @innate/ui 耦合。
- 验证证明：typecheck 绿（修复一处 ReactNode 缺 import 后过）；实际消费验证由 B3（主页）承接——见 task-B3 回填。提交 **f34cae9**。
