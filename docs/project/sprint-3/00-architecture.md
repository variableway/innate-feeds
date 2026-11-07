# Sprint 3 架构决策（一页）

> 结论：**不需要新的仓库级架构文档**。方向已被三份文档覆盖：
> [topic-platform-redesign](../../research/projects/topic-platform-redesign.md)（总案五层）、
> [module-partition-design](../../research/projects/module-partition-design.md)（四向分离）、
> [aihot-ui-adoption](../../research/projects/aihot-ui-adoption.md)（UI 两波）。
> 本页只记录**用户目标带来的三处 delta** 及其调和。

## Delta 1：collector 抽取深度

- module-partition S 系原表述：`cli sync *` 为唯一入口、jobs 以表格形式存在于文档。
- 用户目标：**每个采集器是可独立运行的小模块，各有 CLI 命令**。
- 调和：新增 `backend/src/collectors/jobs.ts` **任务注册表**（代码级单一事实源）：
  每个 job 一条记录（id / 组 / 命令 / 产出 / 模块），`cli sync jobs` 列出全部、
  `cli sync job <id>` 执行任一单个。原子命令（`sync hackernews` 等）全部保留兼容。
  M-Sync 边界同时固化：server 不 import collectors（grep 禁令进 AGENTS.md）。

## Delta 2：可见面 / 风格优先级

- module-partition 原表述：可见仅 trending + starred。
- 用户目标：AIHot 风格优先做**主页、Trending、Trending Shift、Education（/edu）**。
- 调和：Starred 保持可见（核心模块不动摇），风格改造按用户清单排序；
  nav-visibility（B7）最终可见集 = Home + Trending + Trending Shift + Starred +
  Education + Admin（工具）；digest / feeds / topics / dsh 转 hidden（路由保留）。
  module-partition S1 的 nav-visibility 实现合并进本 sprint B7。

## Delta 3：Trending 走势数据

- aihot-ui-adoption 原表述：trending 热点榜走势第一波用 trendshift starsGained。
- 调和：v1 **不引 trendshift**（trending 页双模式数据一致性优先），NO.1 卡展示
  stars / language / description 与 period 分组；走势位留 UI 结构，等 M1 热度数据。
  /trending-shift 页本身即是「势头」页（B5 用 rank-* 色阶换装）。

## 不变项

- 双模式（API / 静态）行为与数据管道零变化；数据纪律（~/.innate，不入库）。
- 域插件机制（topics/* 包）；shadcn token 体系保留，AIHot token 只叠加。
- M1 热度引擎仍是后续主任务，本 sprint 不实现热度。
