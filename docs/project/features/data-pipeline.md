# Feature: data-pipeline

**Status:** done  
**Issues:** —

## 说明

从 GitHub 采集 → SQLite → 增量 JSON chunks（manifest + 按日分片）。

## 验收

- [x] `bun run data:update` 一键流水线
- [x] `frontend/public/data/manifest.json` + chunks
- [x] 文档 [`data-update-workflow.md`](../../data-update-workflow.md)

## 相关代码

- `backend/src/data/export-incremental.ts`
- 根 `package.json` scripts：`data:sync:*`、`data:export`
