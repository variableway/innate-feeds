# B 站教育动画视频采集器（edu-videos-bilibili）

> sprint-3 task-B14 · 2026-11-07 · 源 id：`edu-videos-bilibili`
> 关联：[external-collectors.md](./external-collectors.md)（外部源总览）、
> [edu-animate-domain.md](./edu-animate-domain.md)（域设计）

## 这是什么

B 站教育动画教学视频的采集小模块：按**策展 UP 主清单**抓取其空间投稿列表
（标题 / BV 号 / 封面 / 时长 / 播放量，只收元数据与链接），落
`~/.innate/edu-videos-bilibili/`，经 `/api/external/edu-videos-bilibili` 服务，
在 `/edu/videos` 页面与 YouTube 源合流展示（bilibili 粉色徽章区分）。

## 采集链路（为什么这样做）

B 站没有官方开放 API，空间页的视频列表由客户端 wbi 签名接口渲染，直接抓
HTML 拿不到列表。实测可行的链路（Firecrawl，仓内已有依赖）：

```
UP 昵称 ──Firecrawl search──▶ space.bilibili.com/{mid} 解析出 mid
mid ──Firecrawl scrape(waitFor 10s, markdown)──▶ 渲染后的页面
markdown ──正则解析视频块──▶ [{title, bvid, cover, duration, play}]
```

- 昵称也可是纯数字 mid（直接跳过 search）。
- 播放量文本（"12.5M"/"8900"）解析为数值入 `metrics.score`。

## 如何策展 UP 主

编辑 `backend/src/collectors/vertical/edu-videos-bilibili.ts` 的
`BILIBILI_EDU_UPS`：

```ts
{ handle: "老鹰讲AE", note: "AE 特效教程" },   // 昵称（自动解析 mid）
{ handle: "946974", note: "影视飓风——管道样例" }, // 或直接填 mid
```

挑选标准建议：帧动画 / AE / 手绘 / motion graphics 教学为主链路（对应域内
core 分类语义）。加入后跑一次同步即出现在页面。

## 运行

```bash
cd backend
bun src/app/cli.ts sync edu-videos-bilibili   # 全部策展 UP
bun src/app/cli.ts sync job edu-videos-bilibili  # 等价（jobs 注册表）
```

已登记进 `collectors/jobs.ts`（vertical 组）与源注册表
`shared/sources/external.ts`（加源共两处 + 前端 UI 覆盖一行，S4 流程）。

## 已知边界（2026-11-07 实测）

- 依赖 `FIRECRAWL_API_KEY`（与 Product Hunt 同一依赖）；Firecrawl 不可用时
  无 HTML 直抓回退（空间页服务端不含列表，直抓无意义）。
- 部分空间投稿页抽取 0 条（如「老鹰讲AE」mid=686654641）：可能是页面需登录、
  投稿为音频/专栏类型或渲染差异——采集输出里该 UP 计 0 并不报错，属预期
  可观察行为，换 UP 或用 mid 直填即可。
- 单次每 UP 最多取 100 条（渲染首页投稿网格）。
- 每日配额：search 1 次 + scrape 1 次 / UP，量级可忽略。

## 前端行为

- `/edu/videos`：YouTube + bilibili 合流（bilibili 在前），卡片左上角
  bilibili 徽章；筛选/排序/分页对两源统一生效。
- 封面图必须 `referrerPolicy="no-referrer"`（video-card 已内置）：
  B 站图床 hdslb.com 有 Referer 防盗链，带外站 Referer 一律 403。
- Feeds 菜单内该源为 hidden（nav-visibility），数据照常落盘。
