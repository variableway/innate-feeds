# Feature: data-pipeline

**Status:** done  
**Issues:** —

## 说明

从 GitHub 采集 → SQLite → 增量 JSON chunks（manifest + 按日分片）+ digest 快照 + 可选 README 预取。

## 验收

- [x] `bun run data:update` 一键流水线（当日 trending、近 1 日 starred、近 90 日 digest、export）
- [x] `bun run data:update:window` 近 90 日窗口（含 README prefetch）
- [x] `frontend/public/data/manifest.json` + chunks + `digest.json`
- [x] 文档 [`data-update-workflow.md`](../../data-update-workflow.md)

## 相关代码

- `backend/src/data/export-incremental.ts`
- `backend/src/collector/sync-window.ts`
- 根 `package.json` scripts：`data:sync:*`、`data:export`、`data:update:window`
