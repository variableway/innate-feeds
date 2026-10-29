# Task log: github-topics-datasource

Issue：[issues/github-topics-datasource.md](../../issues/github-topics-datasource.md)（源：GitHub #24 get github tppic feeds）

## 2026-10-28 — in_progress

- 读 issue #24、`docs/project/` 入口、`docs/arch-design/external-collectors.md`
- 确认现状：`backend/src/collector/github-topics.ts` 已有采集器，但只写单文件、前端不可见；且 `fetchSearchViaHttp` 的 URL 拼装有 bug（把整段 path 当 `q` 参数编码）、`best-match` 排序参数写成 `best%20match`
- 与用户确认两处歧义：
  - 「已存在」= 已在 feeds 中 **或** 该 topic 之前采集过（两者都跳过）
  - 跳过 ≠ 丢弃：**点击 topic 时被跳过的仓库仍要展示**
- 确认范围：全栈（采集器 + API + 静态导出 + `/topics` 页面 + 侧栏入口），首个 topic 为 `edtech`

## 2026-10-28 — done

- **后端**：`data/topics-store.ts`（快照存储 + DTO）、`collector/github-topics.ts`（top N / 分页 / 跳过规则 / `firstSeenAt`）、`db/index.ts`（`listKnownRepoFullNames`）、`app/server.ts` + `openapi.ts`（`/api/topics`、`/api/topics/:topic`）、`app/cli.ts`（`--limit` + 统计输出）、`data/export-topics.ts`（静态导出）
- **前端**：`types/topics.ts`、`services/topics.ts`（API/静态双模）、`hooks/use-topics.ts`、`pages/topics/page.tsx` + `pages/topics/topic-page.tsx`、`components/topic-repo-card.tsx`、`web-domain.tsx` 路由 + navItem、`host-shell.tsx` 加 Hash 图标
- **顺手修**：collector 的 HTTP fallback URL bug、`best-match` 参数、`--per-page` 与 `--limit` 的分页组合
- **测试**：`backend/src/collector/github-topics.test.ts` 6 例（跳过规则、firstSeenAt 保留、存储往返、索引计数、slug 安全）
- **证据**：`bun test backend` 63/63；backend/frontend/dsh `typecheck` 全绿；`frontend bun run build` 通过；真机同步 edtech（count 50 / new 41 / skippedExisting 7；重复同步 new 0 / skippedSeen 50）；headless Chrome 截图确认 `/topics` 与 `/topics/edtech` 渲染正常
- **文档**：`docs/arch-design/external-collectors.md`（topic 数据源语义 + 存储 + API）、`AGENTS.md`（接口表 / 模块地图 / 命令 / 变更指引）、`docs/project/issues/github-topics-datasource.md`
- 状态变更：open → done
