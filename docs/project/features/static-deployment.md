# Feature: static-deployment

**Status:** done  
**Issues:** —

## 说明

静态模式构建与 GitHub Pages 部署。每日 UTC 08:00 跑 **90 日 window sync**（digest / 当前 trending / starred / README 预取），再构建并部署。Digest / README 在 Pages 上仍是 **快照 + 浏览器实时 GitHub**。

## 验收

- [x] `build:static` / `deploy.yml`
- [x] `VITE_STATIC_MODE` 前端无后端运行
- [x] 静态 digest：`digest.json` 与 live Issues 合并
- [x] 静态 README：`/data/readmes` 回退，live GitHub 优先
- [x] Pages workflow：schedule 用 window；`workflow_dispatch` 可选 window / daily / skip
- [ ] Pages 线上 URL 确认并写入 overview

## 相关代码

- `.github/workflows/deploy.yml`
- `frontend/src/services/feeds.ts`、`github-live.ts`
- [`data-update-workflow.md`](../../data-update-workflow.md)
