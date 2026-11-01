# Edu Animate 域：教育动画制作垂直聚合

**状态：** 已采纳（2026-11-01 立项并落地）
**范围：** 只做「教育动画制作」这一个垂直切面

本仓在 feeds / dsh 之后新增第三个域插件 `edu-animate/`（包名 `@innate/domain-edu-animate`），
它聚合两个 JSON-store external source：

| 源 | 内容 | 采集器 | 存储 |
|---|---|---|---|
| `edu-skills` | 教育动画领域的 Agent Skill（skills.sh 索引） | `backend/src/collector/edu-skills.ts` | `~/.innate/edu-skills/` |
| `edu-videos` | 策展频道的教学视频（**只有元数据 + 链接**） | `backend/src/collector/edu-videos.ts` | `~/.innate/edu-videos/` |

设计取舍与实测数据见 [`../research/edu-animation-sources.md`](../research/edu-animation-sources.md)。

## 为什么单独开一个域而不是塞进 feeds

- feeds 域是「GitHub 数据浏览器」，其 navItems 分组是 GitHub / Feeds / Admin；教育动画既不是 GitHub 数据也不是社区 feed，混进去会让两个域的边界失守。
- dsh 域已经证明「顶层一个目录 = 一个域插件」的拆分成本很低（`dsh/` 独立包 + `main.tsx` 里多一行 `domains`），照抄即可。
- 分类表要跨层共用（后端两个采集器 + 前端展示），放在 `shared/` 里刚好符合该目录「跨层常量」的既有职责。

## 路由

域 id `edu-animate`（pathless layout）→ 路径前缀 `/edu`，与 feeds / dsh 天然隔离。

| 路径 | 页面 | 说明 |
|---|---|---|
| `/edu` | `EduSkillsPage` | SKILL 列表（本域首页）：关键词 / 分类 / 相关度 / 排序 / 分页 |
| `/edu/videos` | `EduVideosPage` | 教学视频列表：关键词 / 分类 / 排序 / 分页 |
| `/edu/categories` | `EduCategoriesPage` | 分类总览（SKILL + 视频合并计数） |

navItems 分组 `Education`，order 50/51/52（feeds 的 Admin 占 40，dsh 占 30）。

## 分类表：`shared/edu-categories.ts`

8 个分类，单一事实来源，被三处共用：

- `backend/src/collector/edu-skills.ts` —— 按关键词给 skill 归类
- `backend/src/collector/edu-videos.ts` —— 策展分类（人指定）+ 关键词分类（补充）
- `edu-animate/src/**` —— 前端筛选与展示

| id | label | labelZh |
|---|---|---|
| `animation-tools` | Animation Tooling | 动画工具链 |
| `explainer` | Explainer & Educational Video | 科普解说视频 |
| `three-d` | 3D & Game Animation | 三维与游戏动画 |
| `motion-design` | Motion Design | 动效设计 |
| `storyboard` | Storyboard & Scriptwriting | 分镜与脚本 |
| `classroom` | Classroom & Curriculum | 课堂教学 |
| `video-production` | Video Production | 视频制作 |
| `visual-design` | Visual & Illustration | 视觉与插画 |

**口径说明（重要）：** 分类是**多标签**，一个条目可以同时属于多个桶，因此各桶计数之和 **大于** 条目总数。
这是设计选择，不是统计错误 —— 例如 `remotion-render` 同时属于「动画工具链 / 视频制作 / 视觉与插画」。

需要**互斥且加总等于总数**的划分时，用 `relevance`：

| relevance | 含义 | 条数（2026-11-01 实测） |
|---|---|---|
| `core` | 教育动画主链路（教育 / 科普 / 分镜 / Remotion / Manim / Lottie / Whiteboard …） | 214 |
| `related` | 泛动效周边（多为 UI 代码动效） | 229 |
| **合计** | | **443** |

## 数据流

```
skills.sh sitemap ─┐
                   ├─→ EduSkillsCollector ─→ ~/.innate/edu-skills/{manifest,2026-11-01}.json
GitHub API (可选)  ─┘                                  │
                                                        ├─→ /api/external/{source}
YouTube Data API  ─→ EduVideosCollector ─→ ~/.innate/edu-videos/… ─┘
                                                        │
                          data:export ─→ frontend/public/data/external/*.json
                                                        │
                                          edu-animate/src/services/edu.ts
                                          （API 模式 / 静态模式同一套语义）
```

- 静态导出**无需改导出代码**：`backend/src/data/export-external.ts` 自动遍历 `listExternalSources()`，新源自动生效。
- 前端筛选 / 排序 / 分页统一在客户端做：数据量在百级（443 SKILL / ~200 视频），比后端再开一套查询接口更划算，也保证了 API 模式与静态模式行为完全一致。

## 前端包结构

```
edu-animate/
├── plugin.json              # innate.plugin.v1 / kind: domain / id: edu-animate / order: 40
├── package.json             # @innate/domain-edu-animate
├── tsconfig.json
└── src/
    ├── index.ts             # export { webDomain }
    ├── web-domain.tsx       # createWebDomain("edu-animate") + 路由 + navItems/homeTile
    ├── domain-layout.tsx    # 滚动容器（壳由宿主提供）
    ├── types/edu.ts         # EduSkill / EduVideo / EduQuery / EduSearch
    ├── services/edu.ts      # 数据加载 + 筛选/排序/分页（API 与静态同路径）
    ├── components/          # skill-card / video-card / edu-filter-bar / edu-pagination / copy-button
    ├── pages/               # page.tsx (skills) / videos-page.tsx / categories-page.tsx
    └── lib/                 # utils.ts (cn) / format.ts
```

与 dsh 一致：**自包含**，不依赖 `@/` 别名、不依赖 shadcn/ui，用裸 Tailwind 语义 token（`bg-card` / `text-muted-foreground`）。
唯一的跨包引用是 `shared/edu-categories.ts`（相对路径，**无 `.js` 后缀**——dsh 的 `shared/plugin-categories` 也是这样引的）。

## 接线清单

| 位置 | 改动 |
|---|---|
| `package.json` | `workspaces` 加 `edu-animate`；`format:ts*` / `typecheck` 覆盖新目录 |
| `pnpm-workspace.yaml` | 本地文件（**已 gitignore**），pnpm 在 CI 里会从 `package.json` 的 `workspaces` 字段自动生成 |
| `frontend/src/main.tsx` | `domains` 数组加 `eduDomain` |
| `frontend/scripts/build.ts` | Tailwind 扫描目录加 `edu-animate/src` |
| `frontend/scripts/dev.ts` | 同上 + 文件监听加 `edu-animate` |
| `frontend/src/host-shell.tsx` | `ICONS` 加 `GraduationCap` / `Clapperboard` / `LayoutGrid`；`GROUP_ICONS` 加 `Education` |
| `frontend/src/types/external.ts` | `ExternalSourceId` 加两个源；`EXTERNAL_SOURCE_META` 加两条（Feeds 组也能看到） |
| `.github/workflows/ci.yml` | 新增 `Type check edu-animate domain` 步骤 |
| `.github/workflows/deploy.yml` | `sync vc` 已覆盖两个新源；新增 `YOUTUBE_API_KEY` env 与缺 key 时的 warning |

## 命令

```bash
# 根目录
bun run data:sync:edu-skills
bun run data:sync:edu-videos      # 需要 YOUTUBE_API_KEY

# backend
bun run sync:edu-skills
bun run sync:edu-videos
bun src/app/cli.ts sync edu-skills --max 200   # 限制候选数
```

## 已知限制

1. **edu-videos 依赖 `YOUTUBE_API_KEY`**（Google Cloud → YouTube Data API v3）。没有 key 时 `channels.list` 不可用 → handle 解析不出 channel id → 该源整体采不到。CI 里没配 secret 时只打 warning，不影响其它源。
2. **策展频道的 handle 是人工写入的**（`@3blue1brown` / `@TEDEd` / `@kurzgesagt` / `@veritasium` / `@AnimationInsider` / `@SchoolOfMotion` / `@remotion` / `@ManimCommunity`）。handle 写错 → 解析失败 → 该 feed 跳过并记警告，**不会静默指向别的频道**。首次 CI 运行会暴露真实可用集合。
3. **只收元数据与链接**：不下载视频本体、不收字幕正文（版权与存储成本）。
4. **edu-skills 的领域筛选是关键词启发式**：宁可漏，不要把泛 animation 的工程类 skill 混进来。`isEduDomain()` 的关键词表见 `shared/edu-categories.ts`。
5. **skills.sh 的 `/api/v1/*` 不可用**（需 Vercel OIDC，实测 401），所以走 sitemap + 详情页 JSON-LD；详情页抓取有 **10 分钟总时限**，到点用已抓到的部分结果收工，避免上游故障把 CI 拖到 job 超时。
