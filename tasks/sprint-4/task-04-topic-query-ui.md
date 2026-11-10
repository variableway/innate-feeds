# task-04：/topics 分类+步骤两级查询 UI + 静态验证

- 依赖：task-02（分类契约 + 新 topic 数据）、task-03（EDU 三分组数据）
- Issue：[#68](https://github.com/variableway/innate-feeds/issues/68)

## 计划（开工前）

- 做什么：`/topics` 查询面按「分类 → 步骤/子类」两级组织浏览：EDU（3 组）与产品开发
  （5 步）两个分类区，组内直达各 topic 查询（`/topics/:topic`），支持深链与静态模式。
- 功能点：
  ① `frontend/src/pages/topics/page.tsx` 从平铺索引升级为两级分组视图：顶部分类
    （EDU / 产品开发）→ 组内子类/步骤卡片（label + 组内 topic chips + count/new 徽章），
    步骤带序号呈现流程感（brainstorm → … → UI/UX）；
  ② 交互：分类/步骤筛选或锚点导航；保留现有 search 过滤与 Add topic；
    深链 `?group=` / `?step=`（validateSearch，参考 `topics/ux-design` 的 `?tag=` 做法）；
  ③ 分组渲染消费 task-02 的 shared 契约 + task-03 的 EDU 分组数据，不在页面内硬编码
    分组清单；
  ④ 静态模式验证：`bun run build:static` 后 `/topics` 分组视图数据齐全
    （`/data/topics/*.json` + 索引），API/静态双模式不回归。
- 如何验证：API 模式 `/topics` 200 且 DOM 含两分类 ×8 组标题与步骤序号；深链
  `?step=dev-requirements`（id 以定稿契约为准）直达对应组；静态构建后同样可见；
  `bun run typecheck` 绿（frontend + 域包）；既有 `/topics/:topic` 详情不回归。

## 完成回填（完成后）

- 做了什么：`frontend/src/pages/topics/page.tsx` 重写为两级分组视图（消费
  `@/types/topics` 的 shared 契约，无硬编码分组）：EDU / 产品开发两个分类区，
  步骤组带序号徽章 + 流程字幕；组内 topic chips 带 new/count 徽章直链
  `/topics/:topic`；`?group=` / `?step=` 深链聚焦（validateSearch 归一到分组 id），
  聚焦 pill 可退出；未分组 topic（AI 等）平铺「其他 Topics」；保留 search /
  Add topic / pending 提示 / 空态。`web-domain.tsx` 路由加 validateSearch。
  另修 `scripts/preview.ts` Windows 路径 bug（resolve 反斜杠 vs `/` 前缀比对，
  静态文件永远回落 index.html——阻塞静态验证，一并修复）。
- 完成的功能：① `/topics` 按分类+步骤两级组织（2 分类 × 8 组 + 其他区）
  ② 步骤 ①-⑤ 序号呈现流程感 ③ `?group=edu-interactive` / `?step=dev-requirements`
  深链直达并聚焦 ④ API/静态双模式同一视图 ⑤ `/topics/:topic` 详情不回归。
- 验证证明：headless Chrome dump-dom 三轮——**API 模式** `:3000/topics` 11 个
  分组/分类标题全 FOUND（教育·EDU / 产品开发 / 交互式教育 / 授课型教育 /
  教学动画教程 / 头脑风暴 / 需求分析和编写 / 需求任务分解和开发任务编写 /
  实现计划·Spec / UI/UX 设计·分析·优化·Anti-Slop / 其他 Topics）、步骤徽章 ×5、
  chips 含 prd / spec-driven-development；`?step=dev-requirements` 聚焦正确
  （需求分析和编写 ×2、头脑风暴/交互式教育不出现）。**静态模式**
  `build:static` 后 `:4173` 同 11 标题全 FOUND、深链聚焦同上、chips 带
  count/new 徽章、`dist/data/topics` 91 文件。typecheck：backend/frontend/
  dsh/edu-animate 四处绿；`bun test` 123 pass / 0 fail；`/api/topics` 90 项。
