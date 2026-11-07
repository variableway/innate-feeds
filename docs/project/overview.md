# Innate Feeds — 项目现状（2026-11-07，M0 后）

## 定位

GitHub 生态聚合站：trending / starred / digest / 10 个外部 JSON 源 / GitHub Topics /
Trendshift 榜单 + 两个垂直域（DSH 插件目录、教育动画）。**正在向「Topic 精选平台」
演进**（[重构总案](../research/projects/topic-platform-redesign.md)：后台宽进全收，
前台严出精选；M0 已执行，M1 热度引擎待启动）。

## 架构（五层）

```
L4 出口   frontend(host 壳) + topics/<id>/ 域插件包（dsh、edu-animate 已入驻）
L3 服务   Hono API /api/* + 静态导出 JSON 分片（GitHub Pages 双模式）
L2 策划   curation/（M1 新建：热度引擎 / topic 归属）
L1 采集   backend/src/collectors/{core(GitHub系), external(10 JSON源), vertical(dsh/edu)}
L0 基础   SQLite feeds.db + ~/.innate JSON stores + shared/（types/sources/ 常量，S0+S4 单一真相）
```

## 关键事实

- **双模式**：API 模式（Bun + Hono :4000）与静态模式（`VITE_STATIC_MODE=true`，Pages）共用 `services/` 同构 DTO。
- **域插件**：`topics/<id>/` 一包一 topic（`createWebDomain`），宿主 `main.tsx` 组合；新增域 = 建 `topics/<id>/` 即被 `topics/*` workspace 收编。
- **数据纪律**：采集数据只落 `~/.innate`，不进仓库；快照由 CI cron 提交。
- **本地日更**：`bun run data:update:local`（Orca 定时）= trending/starred recent + digest + topics + 外部源。
- **契约单一真相**：wire 类型与外部源注册表在根 `shared/`（纯类型/纯函数/常量，三条边界禁令）。

## 下一步

M1 热度引擎（repo_entities / repo_topic_map / hot_snapshots 三表 + ruleVersion 化
排名 + `GET /api/hot`，≈2 天零 LLM）→ 观察两周 → M2 Topic Hub（首页精选流 + 每个一级
topic 的 Hub 页）。详见[总案 §6](../research/projects/topic-platform-redesign.md)。
