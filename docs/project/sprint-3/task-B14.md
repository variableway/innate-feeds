# task-B14：B 站教育动画视频采集（Firecrawl）+ 域页合流 + 说明文档

## 计划（开工前）

- 做什么：新建 `backend/src/collectors/vertical/edu-videos-bilibili.ts`（策展 UP 清单 → Firecrawl search 解析 mid → 渲染抓取 markdown → 正则解析视频块）；接入 jobs 注册表、源注册表（shared + 前端 UI 覆盖）、cli `sync edu-videos-bilibili`；`/edu/videos` 双源合流（bilibili 徽章）；补说明文档 `docs/arch-design/edu-videos-bilibili.md`。
- 功能点：①每个策展 UP 的投稿视频（标题/BV/封面/时长/播放量）落盘 ②`/api/external/edu-videos-bilibili` ③页面合流 + 平台徽章 ④`sync job edu-videos-bilibili` 可独立运行 ⑤说明文档可指导策展。
- 如何验证：同步输出各 UP 计数；API count>0；/edu/videos 200；bundle 含 bilibili 合流代码；typecheck/构建绿。

## 完成回填（完成后）

- 做了什么：采集器按「search 解析 mid → scrape(waitFor 10s, markdown) → 视频块正则」链路实现（@handle URL 与 JSON 抽取两条路均实测不通后收敛于此，判别过程见执行记录）；jobs/源注册表/cli/ICONS(Tv)/META 六处接线；`services/edu.ts` 增 `loadEduVideosBilibili` 与 `loadEduVideoPool`（YouTube+bilibili 合流，bilibili 在前）、`EduVideo.platform` 字段、VideoCard bilibili 徽章（#fb7299）；说明文档落 `docs/arch-design/edu-videos-bilibili.md`（链路原理/策展方法/已知边界）。
- 完成的功能：①实跑采集成功——影视飓风（mid 946974，管道样例）**42 条视频落盘**，API `count:42` 可查 ②/edu/videos 双源合流展示 ③新源进日更清单（jobs vertical 组）④UP 策展只需编辑 `BILIBILI_EDU_UPS`（昵称或 mid）⑤说明文档成文。
- 已知边界（如实）：「老鹰讲AE」昵称解析 mid 成功（686654641）但其空间页抽取 0 条（疑需登录/渲染差异），采集不报错、计 0 可观察；依赖 FIRECRAWL_API_KEY；每 UP 单次最多 100 条。详见说明文档「已知边界」节。
- 验证证明：`sync edu-videos-bilibili` 输出 ups 计数与 total 42；`/api/external/edu-videos-bilibili` 返回 count 42；`/edu/videos` 200；`__dev_main.js` 含 bilibili/合流代码 ×16；typecheck 全绿；静态构建通过。提交 **472d0f4**（首交 d66ee12 误含 32 个 public/data 数据文件，soft-reset 重做，数据纪律零例外）。
