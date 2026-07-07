# Feature: feeds-trending

**Status:** done  
**Issues:** —

## 说明

展示 GitHub Trending（daily / weekly / monthly），支持按快照日期切换与筛选。

## 验收

- [x] 多 period 同步（`sync:trending`）
- [x] 前端 `/trending` 页面与 FilterBar
- [x] Firecrawl 优先，失败回退 `gh`

## 相关代码

- `backend/src/collector/sync.ts`、`firecrawl.ts`、`github.ts`
- `frontend/src/pages/trending/`
