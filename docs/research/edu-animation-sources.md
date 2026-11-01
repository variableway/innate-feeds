# 教育动画 SKILL 与视频的收集方式

**调研 + 实测时间：** 2026-11-01
**结论落地为：** [`../arch-design/edu-animate-domain.md`](../arch-design/edu-animate-domain.md)

## 问题

要做一个「教育动画制作」垂直聚合站，两类东西要收：

1. **SKILL** —— 教 AI 做教育动画的 Agent Skill（分镜 / Manim / Remotion / 科普脚本 / 课堂课件…）
2. **视频** —— 教学视频（怎么讲、怎么剪、怎么配动画）

需要回答：数据从哪来？免费吗？稳不稳？在本机能跑吗？

---

## 一、SKILL：skills.sh

### 端点实测（2026-11-01）

| 端点 | 结果 | 说明 |
|---|---|---|
| `GET /sitemap-skills-1.xml` | 200，**10,000 条** `<loc>` | 静态 XML，无速率限制 |
| `GET /sitemap-skills-2.xml` | 200，**10,000 条** `<loc>` | 同上 |
| `GET /api/v1/*` | **401** `authentication_required` | 需 Vercel OIDC，只对部署在 Vercel 上的应用开放 → 不可用 |
| `GET /topic/education` | **404** | topic 只有 `react` / `nextjs` / `design` / `ui` / `mobile` / `agent-workflows` / `databases` / `testing` / `marketing` |
| `GET /search?q=…` | 200 但**抓不到 skill 链接** | 客户端渲染，首屏 HTML 里没有结果 |
| `GET /audits` | 200 | — |
| `GET /{owner}/{repo}/{skill}` | 200，HTML 里含 schema.org **JSON-LD** | 见下 |

URL 形态：`https://www.skills.sh/{owner}/{repo}/{skill}`。

### 详情页 JSON-LD 字段

```json
{
  "name": "remotion-render",
  "description": "Render videos from React/Remotion component code via inference.sh. …",
  "publisher": { "name": "…", "url": "…" },
  "interactionStatistic": { "userInteractionCount": 239203 }
}
```

`interactionStatistic.userInteractionCount` 就是**安装量**（实测值例：239,203）。

### 为什么不抓 20,000 个详情页

sitemap 给的是全量 20,000 条 URL。逐个抓详情页既慢又不礼貌，所以做成**两段式**：

1. **slug 级免费过滤** —— 用 `owner/repo/skill` 三个片段拼串做领域判定（`isEduDomain()`），零额外请求。
2. **详情页元数据** —— 只对命中的候选抓，拿到 description / 安装量，再按关键词归类。

实测：20,000 → **443 个候选** → 443 条全部抓成功（core 214 / related 229），覆盖 **128 个仓库**。

### GitHub 补充信息（可选增强）

`GET api.github.com/repos/{owner}/{repo}` 补 stars / license / topics / pushedAt。

- token 取值顺序：环境变量 `GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token`。
- **无 token 就跳过**，不影响采集（实测：443 条里 386 条有 license、331 条有 topics，均来自 GitHub 补充）。
- token 绝不落日志。

### 已知坑

- GitHub Search API **连发即限流**（实测 `API rate limit exceeded`），所以不靠它做发现，只用于按 repo 精确补信息。
- skills.sh 详情页响应较慢（实测单页 3.5s，sitemap 30s），所以并发压到 6，且给详情页抓取加了 **10 分钟总时限**。

---

## 二、视频：YouTube Data API v3

### 单位成本（本轮关键约束）

| 端点 | 单位成本 | 备注 |
|---|---|---|
| `search.list` | **100** | 关键词搜索，最贵；2026-06-01 起每天限 100 次 |
| `playlistItems.list` | 1 | 列一个播放列表的条目 |
| `videos.list` | 1 | 批量取详情（一次最多 50 个 id） |
| `channels.list` | 1 | 取频道信息 |

默认配额 **10,000 单位/天**，太平洋时间零点重置。

→ 本采集器**全程走 1 单位档**，8 个频道约 16 单位/轮，稳在免费配额内；不用 `search.list`。

### 策展清单用 handle 而不是 channel id

YouTube channel id 是 24 位随机串（如 `UCYOy_jdiQBSIczO2n0RStEg`），写死在代码里既没法肉眼核对，写错了还会**静默指向别的频道**。

所以策展清单存**可读的 handle**（`@3blue1brown`），采集时用 `channels.list?forHandle=@handle` 解析成 id：

```
handle 写错 → 解析不到 → 该 feed 记一条警告并跳过 → 不会产生错误数据
```

策展的 8 个频道：

| id | 频道 | handle | 策展分类 |
|---|---|---|---|
| `3b1b` | 3Blue1Brown | `@3blue1brown` | explainer |
| `ted-ed` | TED-Ed | `@TEDEd` | explainer |
| `kurzgesagt` | Kurzgesagt | `@kurzgesagt` | explainer |
| `veritasium` | Veritasium | `@veritasium` | explainer |
| `animation-insider` | Animation Insider | `@AnimationInsider` | animation-tools |
| `school-of-motion` | School of Motion | `@SchoolOfMotion` | motion-design |
| `remotion` | Remotion | `@remotion` | animation-tools |
| `manim-community` | Manim Community | `@ManimCommunity` | explainer |

### 只收元数据 + 链接

不下载视频本体、不收字幕正文。理由：版权、存储成本、以及站点定位（给的是「参考片」而不是视频库）。

每条视频落库的字段：标题、频道、时长、播放量、点赞、发布时间、缩略图 URL、观看页 URL、策展者备注、分类。

### 需要 `YOUTUBE_API_KEY`

Google Cloud → 启用 YouTube Data API v3 → 建 API key。没有 key 时 `channels.list` 不可用 → handle 解析不出 → 该源整体采不到。CI 没配 secret 时打 warning 跳过，不影响其它源。

---

## 三、本机网络可达性（cn 区）

**这一节的结论直接决定了「视频采集只能放 CI」。**

| 目标 | 结果 |
|---|---|
| `www.skills.sh` | ✅ 可达（但有波动，实测 sitemap 30s / 详情页 3.5s） |
| `api.github.com` | ✅ 可达 |
| `raw.githubusercontent.com` | ✅ 可达 |
| `youtube.com` | ❌ 不可达（http=000） |
| `googleapis.com` | ❌ 不可达（http=000） |
| `wikidata.org` / `wikipedia.org` | ❌ 不可达（故无法核实 channel id） |

已试过并全部失败的取视频路径：YouTube RSS、YouTube Data API、Invidious、Piped。

**所以：** edu-skills 本机可完整跑通并已实测；edu-videos 的**真实链路无法在本机端到端验证**，解析逻辑由单测覆盖（7 个用例），真实可用集合由首次 CI 运行暴露。

---

## 四、SKILL 生态的质量与安全背景

调研中顺带查到的公开数据（用于给「安装量」这个指标加注释）：

- **SkillsBench**：47,150 个 skill 的平均分 **6.2 / 12**；经策展（curation）后提升 **16.2 个百分点** —— 说明「安装量高」不等于「质量好」。
- **Snyk ToxicSkills**：36% 的 skill 含潜在 prompt injection。
- 一次大规模审计在 22,511 个 skill 中查出 **140,963 个问题**。
- **agency-agents** 实测 184 个 skill，且在两个平台各存一份 —— 所以去重必须用 `(host, owner, repo, path)` 四元组，不能只用 skill 名。

这些是外部数据，不影响本次采集逻辑，但解释了为什么本仓的 `edu-skills` 同时展示 **安装量** 与 **GitHub stars / license / archived** —— 单看安装量会被刷量误导。

---

## 五、最终方案与实测产出

### edu-skills

```
skills.sh sitemap（2 分片 × 10,000 条）
  → slug 级领域过滤（isEduDomain，零请求）
  → 443 个候选
  → 详情页 JSON-LD（并发 6，20s 超时 × 2 重试，10 分钟总时限）
  → GitHub API 补 stars/license/topics（可选）
  → ~/.innate/edu-skills/2026-11-01.json
```

**实测产出：443 条 / 128 仓库 / 718,792 字节 / core 214 + related 229 = 443（互斥且加总相等）。**

数据完整性核对：0 条缺标题、0 条缺描述、0 条安装命令格式错误、443 条 skill 唯一（无重复）。

分类分布（**多标签，各桶之和 934 > 443**）：

| 分类 | 条数 |
|---|---|
| 动画工具链 | 396 |
| 视觉与插画 | 114 |
| 视频制作 | 111 |
| 分镜与脚本 | 91 |
| 科普解说视频 | 81 |
| 动效设计 | 82 |
| 三维与游戏动画 | 44 |
| 课堂教学 | 15 |

安装量 Top 5（实测）：

| 安装量 | Stars | 仓库 · skill |
|---|---|---|
| 1,005,069 | 76.8k | `heygen-com/hyperframes` · hyperframes-animation |
| 723,826 | 6.0k | `remotion-dev/skills` · remotion-best-practices |
| 550,138 | 76.8k | `heygen-com/hyperframes` · remotion-to-hyperframes |
| 521,699 | 76.8k | `heygen-com/hyperframes` · faceless-explainer |
| 514,017 | 76.8k | `heygen-com/hyperframes` · motion-graphics |

### edu-videos

```
策展 handle 列表（8 个）
  → channels.list?forHandle=  （1 单位）
  → UU{channelId.slice(2)} uploads 播放列表
  → playlistItems.list（1 单位）
  → videos.list（1 单位，50 个 id 一批）
  → ~/.innate/edu-videos/latest.json
```

真实链路未在本机验证；解析逻辑由 `backend/src/collector/edu-videos.test.ts` 的 7 个用例覆盖。

---

## 六、试过但行不通的做法（别重试）

| 做法 | 结果 |
|---|---|
| `skills.sh/api/v1/*` | 401，需 Vercel OIDC |
| `skills.sh/topic/education` | 404 |
| `skills.sh/search?q=` | 客户端渲染，首屏 HTML 抓不到 skill 链接 |
| YouTube RSS / Data API / Invidious / Piped | 本机全部 http=000 |
| Wikidata SPARQL / Wikipedia | 本机不可达，无法核实 channel id |
| GitHub search API 连续请求 | 连发即限流 |
| `gh api search/code` 连续多次 | `API rate limit exceeded` |
| macOS 上的 `timeout` 命令 | 不存在，改用工具自带 timeout 参数 |
| `python3 -c "import yaml"` | 无 pyyaml，改用 `cd backend && bun -e 'import {load} from "js-yaml"; …'` |
