# Open Apps / Open App Scout（tortuvshin/open-apps）源码机制分析

> 调研日期：2026-11-02。源码：用户提供的 `harry0703/open-apps` clone 到 `references/open-apps/`（gitignored，不入库）。**它是 fork，原始项目（上游）是 [tortuvshin/open-apps](https://github.com/tortuvshin/open-apps)**（openappscout.com，4493 stars，684 commits，129 位贡献者，上游活跃至 2026-11-01）。已按用户要求在本地把 fork（@2026-09-03，500 commits）与上游原始项目（@2026-11-01，684 commits）做了合并（见 §1），以下分析以合并后的上游最新代码为准。
>
> 定位：**一个人工精选、自我刷新的开源应用目录**——每个应用一个 Markdown/YAML 记录，人类策展字段与自动化 GitHub 元数据共存，Grove 框架 + Astro 构建静态站，CI 每周用可评审的 PR 刷新元数据，README 自动生成，llms.txt 给 AI。它是「awesome-list → 结构化可搜索目录」演进的完整工程范本。

## 0. 关键结论（先读这里）

1. **字段所有权是第一设计原则**：每个记录的字段二分为 human-curated（PR 手改）与 automation-owned（`github.*`/`health.*`，Grove Action 写入，明文「never hand-edit」）。自动化元数据甚至**不放在记录文件里**（上游已移到 `data/cache/github/<slug>.json`，构建时合并），PR diff 里人工策展与机器数据彻底分离——「没有静默变更」，一切机器改动走可评审 PR。
2. **上游已从「awesome-list」长成「 Scout 站」**：214 个记录（`content/records/*.md`，frontmatter + 评审笔记合一）、25 个「XX alternatives」选题合集（带 selectionNote 可审计）、`relations: alternative-to`（须附证据 quote + URL + checkedAt）、每记录 `seo.title`（65 字符规范）、`submittedBy` 贡献者署名与引流闭环（`ref=openappscout.com` + README badge）。
3. **Bot 评审 PR**：`submission-review.yml` 用 `pull_request_target` 只取 PR 的**记录文件**（data，不是 scripts，安全模型清晰）放到 main 代码上跑 `review-submission.mjs`，在 PR 上贴一条 sticky 评论：taxonomy 校验、重复仓库检测、repo 状态/license、商店链接可达性、笔记完整性；判定三态 `blocked / needs human review / ready`，且「无法检查的一律标 unknown，绝不标 pass，exit code 恒 0」。
4. **SEO 是工程而非玄学**：`seo:check` 机检每页 title ≤65 / description 70–160、标题分隔符统一、禁用 repo slug 当 H1；Cloudflare Worker 对带查询串的 HTML 加 `X-Robots-Tag: noindex`（过滤/排序参数页不该被索引）；README 链接 ↔ dist 页面双向核检；lychee 月度链接检查复用缓存、429/5xx 不缓存，产出一个**常驻 issue** 原地更新而非刷屏。
5. **收录有明确标准 + 死亡有可追溯程序**：CONTRIBUTING 写明「可用应用，不是库/教程/样板/营销页」，「流行度是参考不是通行证」；过期清扫（6 个月无 push）删 92 条记录时**写了先例文档**（stale-exclusion 文档记录每条的 last push），fallback 的软删除模式（`visibility: remove` + `excludedReason`）也预先定义。
6. **Grove 框架的 registry-first 迁移值得注意**：v1 把全部 UI 从包导出改为 shadcn registry 安装源码到仓库（`grove update --check/--diff` 对账，本改文件永不覆盖，冲突退出码 2），「框架管数据管线、UI 归站点自有」——与我们的 `@innate/ui` vendored shadcn 组件路线**完全同构**。
7. **fork 与上游已显著分叉**：fork（harry0703）停在 2026-09-03（Grove 0.9，89 条 YAML 记录）；上游已演进到 Grove 1.2、记录转 Markdown、新增 pagefind 全文搜索、subject 选题合集等。fork 的独有内容（MangoDisk 等经 PR #240 已合入上游）无保留价值，合并时全部以 upstream 为准。

## 1. fork 与原始项目的本地合并（应用户要求）

| | fork（origin） | 上游原始项目（upstream） |
|---|---|---|
| 仓库 | harry0703/open-apps | **tortuvshin/open-apps**（原始） |
| 快照时间 | 2026-09-03 | 2026-11-01（活跃） |
| commits | 500（历史被改写） | 684 |
| 记录 | 89 个 YAML（`data/records/`） | 214 个 MD（`content/records/`）+ 4 个 YAML 遗留 |
| Grove | 0.9.0 | 1.2.0（stable API + semver） |
| 独有 | 无实质独有（MangoDisk 已由 PR #240 于 2026-09-03 合入上游） | pagefind 搜索、submission-review bot、links 检查、subjects 关系、25 合集、contributor 引流 |

合并过程（本地，`references/` 不入库、不推送）：

1. fork 历史被改写（两边的 2019 "Initial commit" 哈希不同）→ `git replace --graft` 把上游根嫁接到 fork 根，使历史重新相关；
2. `git merge upstream/main` 产生 **268 个 both-side 冲突**——逐一核验后确认上游对 fork 是**严格超集**（fork 的全部冲突文件在上游都有更新版本，fork 无一独有内容存活）；
3. 全部按 `--theirs`（upstream）解决，外加一个 Windows 大小写不敏感产生的 `BeeCount.md/beecount.md` 文件名矫正；
4. 合并结果 = 上游最新（214 记录 + 25 合集 + 1033 文件），fork 视图完整保留在 `origin/main` ref 上可随时对照。

这个合并本身就是一个观察样本：**目录类项目的「数据即状态」让 fork 分叉几乎无意义**——记录、taxonomy、health 都是上游持续刷新的活数据，fork 停两周就落后一个生态位。

## 2. 项目是什么

| 维度 | 内容 |
|---|---|
| 产品 | [openappscout.com](https://openappscout.com)（Astro 静态站 + Cloudflare）；README 是 awesome-list 视图，与站点**同源生成**（`grove readme generate`，手工只改 YAML） |
| 数据 | 每个 app 一个记录文件：人工字段（name/category/stack/bestFor/whyListed/caveats/seo.title…）+ 笔记正文；自动化字段（stars/license/pushed_at/health）在 `data/cache/github/` |
| 框架 | [Grove](https://withgrove.dev)（`@grove-dev/{core,astro,cli}` 1.2）——目录站专用框架：blueprint（project-directory）、记录 schema 校验（`grove check`）、GitHub 同步、README 生成、OG 图、llms.txt、sitemap |
| 规模 | 214 记录 / 25 合集 / 38 个 grove 组件 / 17 页面路由 / 9 个 workflow / 129 贡献者 |
| 部署 | Cloudflare Pages（assets binding）+ Worker 边缘规则（仅 SEO 头） |

三类数据源明确分工（`data/README.md`）：**可手改**（records/collections/taxonomy）、**勿手改**（cache/github、generated/*——「下次 sync 会覆盖」「在 sync commit 之外改 cache 的 PR 几乎都是错的」）。

## 3. 记录模型：人类策展 × 自动化元数据

记录（`content/records/<slug>.md`）= YAML frontmatter + Markdown 笔记。关键字段与治理：

- **身份与叙事**：`name` / `description`（一句话）/ `summary`（编辑导语）/ `sourceDescription`（从 GitHub description 机械回填，与 summary 并存时展示「From the project's README:」）——三种描述分别服务卡片、详情页导语、原声引用。
- **SEO 字段是必填实践**：`seo.title` 规范「`{Name} – Open Source {它是什么}`」≤65 字符，写明「用人们知道的名字（Kodi 不是 xbmc）」「只有项目自己这么说才写 Alternative」「禁关键词堆砌/禁年份」。`seo:check` 对全站构建产物机检。
- **关系证据化**：`relations: [{ type: alternative-to, to, evidence: { type: repo-topic, url, quote, checkedAt } }]`——「备选关系」必须引用项目自己的 README/topic 原文，注明核验时间。`data/taxonomy/subjects.yml` 只收「至少一条记录有可核验证据」的 subject。
- **health 系统全自动化**：`status`（active/mature/stale/archived）/`tier`（curated/listed/experimental）/`cleanupCandidate`/`confidence`/`reasons`（如「Pushed within 6 months」「Strong adoption with maintenance signals」）由 Grove 从 `pushed_at` 等计算，人只决定 keep/hide/remove。
- **collection 是查询不是手工清单**：`data/collections/*.yml` 声明 `query`（stacks/excludeStatuses/minStars）+ `ranking.preset`（quality/active）+ 必填 `editorial.selectionNote`（入选逻辑白纸黑字，可审计）。「Trending」= 排除 archived/stale + ≥100 stars，按活动分（70% 发布/push/近三月 commit 占比 + 30% push 新近度）——明示「不是 star 增长榜，star 历史尚未追踪」。
- **迁移路径**：记录从 YAML → MD（frontmatter+正文合一）是一步一步来的（fork 还停在 YAML 时代）；4 个老记录仍 YAML，由 #287 追踪——迁移有账、不搞大爆炸。

## 4. 自动化矩阵（9 个 GitHub Actions）

| Workflow | 触发 | 做什么 | 治理设计 |
|---|---|---|---|
| `ci.yml` | push/PR | icons 漂移检查 + `grove check` + build + `seo:check` | 数据坏 → 构建失败 |
| `sync-github.yml` | 每周日 + **records 变更即时** | `grove sync github` → **开 PR**（不开直推） | 「A record merged on Monday used to wait until Sunday」——注释记录了为什么改 |
| `readme.yml` | 每周一 | `grove readme generate` → 有 diff 才开 PR | README 是产物不是源 |
| `sync-contributors.yml` | 每周一 | contributors.json + recent-pulls.json（过滤 bot） | 社区墙非排行榜 |
| `submission-review.yml` | PR 改记录 | **bot 评审评论**（见 §5） | `pull_request_target` 只拷 data 不执行 PR 代码 |
| `cleanup.yml` | 每月 + sync 后 | `grove cleanup` → **常驻 review-queue issue 原地编辑**（编辑 body 不发通知） | 「零发现不开 issue，开着的安静关闭」 |
| `links.yml` | 每月 2 日 | lychee 全站链接检查（缓存 1 天，429/5xx 不缓存）→ **常驻 broken-links issue** | 「断链是维护任务不是构建失败」（`fail: false`） |
| `deploy.yml` | push main | build + 传 dist artifact | SITE_URL 变量化 |
| （submit 表单） | 站点 | 表单从 GitHub URL 生成记录草稿 → 用户复核 → 开 PR | 贡献入口在产品里 |

「常驻 issue 原地更新」是它反复使用的手法（cleanup 队列、断链报告都是）——通知只在该从空到非空时发生一次，之后静默。

## 5. Bot 评审 PR（最值得抄的机制）

`submission-review.yml` + `scripts/review-submission.mjs`：

- **安全模型**：`pull_request_target` 有 token 权限但**只 checkout main**，然后从 PR head 只拷贝记录文件（文件名白名单 `[A-Za-z0-9._-]+`）进来——「用 main 的代码评审 PR 的数据」，PR 的脚本永远不执行。
- **评审内容**：grove check 错误/警告、重复仓库（对全库 repoUrl 归一化比对）、GitHub repo 是否 missing、license 是否可识别、`distribution.channels` 的商店链接可达性（GET 探测，403/429 标「bot-blocked?」为 unknown 而非 fail）、有没有笔记正文。
- **判定哲学**：三态 `blocked / needs human review / ready`；**任何无法核验的东西（限流、无 token、网络）都是 unknown，绝不当作通过**；脚本 exit code 恒 0——「评审失败不是 CI 失败」，由人看评论决定。
- sticky comment（`marocchino/sticky-pull-request-comment`）保证一个 PR 只有一条评审评论可原地更新。

这套东西直接可映射到我们的场景：**外部 collector 的 PR 化数据回写 + bot 预评审**（例如 GitHub Topics/awesome-dsh 同步结果开 PR，bot 贴 diff 摘要与异常检测，人复核合并）。

## 6. 站点与 SEO 工程

- **Astro 静态 + 页面级客户端增强**：browse 页（`directory-index-client.astro` 22.6K）客户端过滤/排序/搜索；上游再加 **pagefind**（build 后 `pagefind --site dist`）全文搜索——静态站搜索的两代方案我们都可直接参考。
- **Worker 边缘 SEO 规则**：`wrangler.jsonc` 的 `run_worker_first` 只对列表路由启用 Worker，给带查询串的 HTML 加 `X-Robots-Tag: noindex, follow`，注释把动机讲得很清楚（「crawler 拿到的第一份 HTML 是可索引的，参数页带着过期计数被索引了——响应头在任何渲染之前解决它」）。
- **OG 图全量预生成**：259 张（每记录/分类/合集/stack/license 一张），构建期生成入库。
- **双向核检**：README 里的站内链接必须在 dist 有对应页面；每页 title/description 长度与规范机检；canonical 指向干净 URL。
- **AI 出口**：`llms.txt`（站点指南）+ `llms-full.txt`（全目录）从同一份记录生成——与我们观察到的 AIHOT、monid 调研一致：**llms.txt 已是目录类站点标配**。

## 7. 生态位与治理哲学

- **收录标准写成产品规则**：good/avoid 列表直接进 `grove.config.ts` 的 submission 配置（「可安装可运行的应用」「有可验证 license」「不是库/教程/样板/营销页/弃坑实验」）；「流行度是参考不是自动通过——评审看产品范围、源码质量、维护、文档、学习价值」。
- **删要有先例**：2026-08-11 清扫删 92/150 时写了完整文档（cutoff、每条 last push、决策模式），下一次清扫照此办理——**数据删除的可追溯性**与 Radar 的 404 保留、我们的 hidden.json 是同一问题的三种答案。
- **贡献者激励闭环**：`submittedBy` 署名（页面 + /community）、外链带 `ref=openappscout.com`（项目方在自己 analytics/GitHub Traffic 里看到来源）、详情页侧栏提供「Featured on Open App Scout」badge 代码——目录站给被收录方的回礼设计，增长引擎写进了 schema。
- **CHANGELOG 当架构决策记录用**：Grove 0.6.1→0.8.0→1.0.0 的两次大迁移在 CHANGELOG 里写满了动机、字节级验证（「140 个构建产物逐字节在场」）、保留的本地 fork 清单与上游化计划——比多数项目的 ADR 还细。

## 8. 与 innate-feeds 对照与借鉴清单

| # | 它的做法 | 我们现状 | 建议动作 |
|---|---|---|---|
| P1 | **字段所有权二分**（human vs automation，机器字段出记录文件进 cache） | feeds.db 快照 JSON 全量导出到 `frontend/public/data`，无所有权概念 | 若做数据 PR 化（见下），先定 schema 的 ownership 分组 |
| P1 | **自动化以 PR 呈现 + bot 预评审** | daily sync 直接写仓库（`chore: update feed snapshot` 直推） | 评估 snapshot PR 化：bot 贴 diff 摘要/异常（star 骤降、404 repo、隐藏项变化），人复核合并；上游的 review-submission 三态判定（unknown≠pass）直接照抄 |
| P1 | **常驻 issue 原地更新**（cleanup 队列/断链报告） | 无运行报告机制 | sync 失败/数据异常开一个常驻 issue 原地编辑，替代邮件式告警 |
| P2 | **health 计算 + cleanupCandidate**（pushed_at 阈值 → reasons 列表） | starred/trending 无健康度 | digest/trending repo 可加 active/stale 标签（6 个月无 push），前端过滤「弃坑」 |
| P2 | **collection = query + selectionNote**（可审计的选题） | 无合集概念；topics 算手工策展 | 若做「教育精选集」类页面，抄它的 query+note 模式，选题逻辑进数据不进代码 |
| P2 | **relations 证据化**（alternative-to + quote + checkedAt） | 无 | 远期：若做项目间关系（同作者/同类/备选），证据字段是必选项 |
| P2 | **llms.txt / llms-full.txt** | 无 | 静态导出加这两个文件（AIHOT 报告同样建议，成本半天） |
| P3 | **SEO 机检**（title≤65/desc 70–160/参数页 noindex） | Pages 站无 SEO 检查 | `build:static` 后加一个 meta 检查脚本 |
| P3 | **贡献者署名 + ref 引流 + badge** | 无对外贡献入口 | 不适用（非目录站），记录其模式 |
| P3 | Grove registry-first（UI shadcn 化 + update 对账） | `@innate/ui` vendored 已同构 | 无动作，互相印证 |

**不学的**：① 目录站形态本身与我们互补而非可替代——但注意 openappscout 已收录大量「可运行的开源应用」，我们的 trending/starred 若做「应用发现」会有生态位重叠，差异化在「按时间的热度与个人 star 流」；② Cloudflare Worker/OG 预生成等运营重资产，Pages 场景暂不需要。

## 9. 一句话总结

Open Apps（上游 tortuvshin）展示了 awesome-list 的工业化为：**记录即数据（所有权二分）、自动化即 PR（bot 预评审、可评审回写）、删除即文档（先例制）、SEO 即构建检查、增长即 schema（署名/badge/ref）**——fork（harry0703）只是上游 2026-09-03 的快照无独立价值；对我们最直接的启发是 **P1 的「数据回写 PR 化 + bot 预评审 + 常驻 issue」治理三件套**，正好补上我们 daily sync 直推、无运行报告的短板。
