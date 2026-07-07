# Feature: static-deployment

**Status:** done  
**Issues:** —

## 说明

静态模式构建与 GitHub Pages 部署；每日 UTC 08:00 更新数据并可选 commit chunks。

## 验收

- [x] `build:static` / `deploy.yml`
- [x] `VITE_STATIC_MODE` 前端无后端运行
- [ ] Pages 线上 URL 确认并写入 overview

## 相关代码

- `.github/workflows/deploy.yml`
- `frontend/src/services/feeds.ts`（静态分支）
