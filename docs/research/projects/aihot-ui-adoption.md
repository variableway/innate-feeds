# AIHot UI 风格采纳计划

> 状态：**计划 · 未执行**（2026-11-07）· 本文档只做计划，不含任何已实施修改
> 关联：[module-partition-design.md](./module-partition-design.md)（可见面收缩，S1-S5）、
> [topic-platform-redesign.md](./topic-platform-redesign.md) §4（场景→布局映射）、
> [../research/aihot-analysis.md](../aihot-analysis.md)（源码分析）
> 证据源：`references/AIHOT/apps/web/app/`（本地克隆，gitignored，锚 `92e4a15`）

## 0. 原则

- **采纳风格，不复刻站点**：借它的 token 体系、布局原语与场景布局，不搬它的
  路由/数据层。
- **叠加不推翻**：现有 shadcn token 体系是 vendored shadcn/ui 组件的依赖，全部
  保留；AIHot token 作为「编辑风格扩展层」共存。
- **两波节奏**：第一波纯样式与布局（现有数据即可）；第二波等 M1 热度引擎数据。

## 1. 第一波 A：Token 层叠加（`frontend/src/styles.css`）

从 AIHot `app.css` 的 `@theme`（25-73 行）移植以下 token（值随实现时拷贝，
暗色一并）：

| 类别 | AIHot token | 语义 | 我们的落点 |
|---|---|---|---|
| 文字层次 | `ink` `ink-2` `ink-3` `ink-4` | 四级正文灰阶（比 foreground/muted 两级更细） | 叠加映射：ink→foreground、ink-2/3/4→细分 |
| 热点强调 | `hot` `hot-soft` | 热点条 / 榜单徽章强调色 | 新增 |
| 榜单排名 | `rank-1` `rank-2` `rank-3` `rank-rest` | 前 3 名彩色 + 其余灰（热点条前 5 行的关键） | 新增 |
| 圆角六档 | `mark 5 / control 8 / tile 10 / card 12 / panel 14 / sheet 16` | 按元素档位命名而非单一 --radius | 新增档位变量 |
| 阅读列 | `--page-max-reading`（760px 阅读列） | 详情页阅读宽度 | 新增布局变量 |

**不做**：AIHot 的 `touch`（44px 触控）/ `short`（紧凑）变体——留给 M2 手机壳评估。

## 2. 第一波 B：布局原语移植（`frontend/src/components/layout/` 新建）

| 原语 | AIHot 出处 | 结构要点 | 用途 |
|---|---|---|---|
| `ReadingLayout` | `components/ui/Page.tsx:12` | `mx-auto grid max-w-[page-max-reading]`，`lg:` 起单栏+右侧 300-340px 栏 | repo 详情页 |
| `ArticleLayout` | `Page.tsx:28` | 2xl 起 `[200px_760px_200px]` 三栏，左右 sticky rail（`scrollbar-thin sticky top-6`） | 未来的日报/长文页（M4） |
| `EmptyState` | `Page.tsx:100` | 标题 + `text-ink-3` 说明 + action | 各列表页空态统一 |
| `PillTabs` 变体 | AIHot PillTabs | 药丸形筛选芯片 | starred 筛选、digest 源切换 |

现有 shadcn `Tabs/Sheet/Badge` 保留直接用；原语总量 ≈100-150 行，均为纯展示组件。

## 3. 第一波 C：两个可见页换装

### `/trending` ← AIHot 热点榜（`/hot`）布局

```
NO.1 大卡（名称+一句话+走势条+跨源徽章）
NO.2 / NO.3 中卡（两列）
NO.4-10 行榜（rank-* 色阶行）
页尾折叠：「热度怎么算」（ruleVersion 公式透明）
```

- 数据：第一波用现有字段（stars + trendshift `starsGained` 做走势）；
  **「热度怎么算」折叠第一波放占位**，公式展示等 M1 的 ruleVersion。
- 现有 FeedCard 降级为行榜行，不删除。

### `/starred` ← AIHot 精选流（首页）布局

- 按 `starred_at` 日分组时间轨（ sticky 日期头）+ 顶部 PillTabs 筛选芯片
  （language / topic 快捷项）。
- 卡片信息结构照 AIHot：来源行 + 徽章 + 标题 + 摘要 + **入选理由**（第一波留位，
  M2 curation 填充）+「另外 N 家也报道」（= 跨源信号徽章，等 M1）。

### repo 详情（两页共用的点击态）

- 现有 master-detail 保留；借 AIHot 条目详情的**右栏 RailCard 分节**：
  README / 为什么热（M1）/ 相关 topic（topics 数据已有）。

### 不投入（hidden 页）

digest / feeds / topics / trending-shift / dsh / edu 不改——M2 Topic Hub 时按
§4 场景（索引网格 / 富头部 / DayList / 报纸版面）各自对号。

## 4. 第二波（依赖 M1 热度引擎，M1 后启动）

| 项 | 依赖 |
|---|---|
| 热点条（首页顶部前 5 彩色排名行） | `hot_snapshots` 排名 |
| 「热度怎么算」公式折叠实装 | `ruleVersion` |
| 跨源信号徽章（trending #2 · trendshift #1 · GitHubDaily 推荐） | `repo_entities` 全源归并 |
| 入选理由字段 | curation 精选席位 |

## 5. 执行顺序与工作量

| 阶段 | 内容 | 量级 | 前置 |
|---|---|---|---|
| W1 | Token 叠加（§1） | 0.5 天 | 无，可与模块划分 S1-S5 并行 |
| W2 | 布局原语（§2） | 0.5 天 | W1 |
| W3 | trending 热点榜 + starred 时间轨 + 详情 RailCard（§3） | 1-1.5 天 | W2；与 nav-visibility 收缩后状态衔接 |
| W4 | 第二波（§4） | 1-1.5 天 | **M1 完成** |

第一波合计 ≈2-2.5 天。建议时序：**模块划分 S1-S5（1.25 天）→ M1（2 天）→
本计划 W1-W3（M1 跑观察期时并行做样式层）→ W4**。

## 6. 验收

1. token：`styles.css` 含 ink/hot/rank/radius 六档，暗色完整；shadcn 组件视觉零回归。
2. 原语：三原语入 `components/layout/`，有纯展示单测或 Storybook 式预览页。
3. 页面：trending 呈 NO.1/2-3/4-10 三层结构；starred 呈日分组时间轨；
   双模式（API/静态）构建绿。
4. 第二波验收在 M1 后另定（热度值可解释、徽章跨源可追溯）。
