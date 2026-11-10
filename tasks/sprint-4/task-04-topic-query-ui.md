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

- 做了什么：
- 完成的功能：
- 验证证明：
