# Feature: feeds-starred

**Status:** done  
**Issues:** —

## 说明

展示用户 Starred 仓库，含 `starred_at`，支持全量与近期增量同步。

## 验收

- [x] `sync:starred` / `sync:starred:recent`
- [x] 前端 `/starred` 页面
- [x] 按 starred 日期排序

## 相关代码

- `backend/src/collector/github.ts`、`sync.ts`
- `frontend/src/pages/starred/`
