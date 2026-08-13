# Contract: feeds-api-v1

**Version:** v1.0  
**Date:** 2026-07-06  
**Parties:** frontend `services/feeds.ts` ↔ backend `app/server.ts`  
**Issues:** ui-layout（done）

## 提供方承诺

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/feeds` | 列表；query: `type` (`trending` \| `starred` \| `digest`), `language`, `topics`, `search`, `sort`, `order`, `date`, `starsMin`, `starsMax`, `page`, `pageSize` |
| GET | `/api/feeds/digest/:id` | Digest 详情（含 body） |
| GET | `/api/repos/:owner/:repo/readme` | README：磁盘缓存优先，后台刷新 GitHub |
| GET | `/api/feeds/stats` | 聚合统计 |
| GET | `/api/feeds/languages` | 语言列表 |
| GET | `/api/feeds/dates` | trending 快照日期 |
| POST | `/api/feeds/sync` | 触发同步（Zod 校验 body） |

## 消费方需求

- 开发环境 Vite 代理 `/api` → `localhost:4000`
- 静态模式走 `manifest.json` + chunks + `digest.json`；digest/README 仍可直连 GitHub live

## 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.1 | 2026-08-13 | digest 快照 + live；README 缓存 + 实时刷新；90 日 `sync window` |
