# Issue: dsh-catalog-sync

**Status:** done  
**Source:** [variableway/innate-feeds#27 awesome dsh plugin 信息](https://github.com/variableway/innate-feeds/issues/27)  
**Opened:** 2026-10-31 · **Assignee:** —  
**Feature:** —（数据更新链路）

## 背景

`awesome/awesome-dsh-plugin/data`（vendored 目录快照）自 2026-08-19 后从未更新（2742 个插件，stars `checkedAt` 停留在 8 月），issue #27 要求调研更新方案并落地。

## 调研结论（2026-10-31）

| 方案 | 结论 |
|---|---|
| 上游 npm 包 `dsh-plugin-catalog`（每日发布） | ❌ schema 不同：无 screenshots（详情页需要）、多 capabilities/downloads 字段；直接换源会丢功能 |
| GitHub contents API 逐文件拉取 | ❌ 2742+ 请求，不可行 |
| 上游 repo tarball（codeload 单请求） | ✅ 与 vendored 结构完全一致（`plugins/*.yml` + 4 个 JSON map） |
| stars 新鲜度 | ⚠️ 上游 git 里提交的 `stars.json` 只是 floor（实测 max `checkedAt` 落后近 2 月），新鲜数据只在每日发布的 npm catalog 里 → tarball 为主 + npm overlay 补 stars/added-dates |
| 分类 | ⚠️ 上游新增 3 个分类（`wsl`/`identity`/`agi`，共 215 个插件），原 20 分类白名单会静默过滤 → `shared/plugin-categories.ts` 补齐至 23 |

## 交付物

- [x] `backend/src/collector/dsh-catalog.ts`：tarball 下载（GITHUB_TOKEN 可选）+ 内置 tar 解析（ustar/GNU longname/pax path）+ 校验（≥500 插件、JSON 可解析）+ staging 原子替换 + npm `dsh-plugin-catalog` stars/dates overlay（`DSH_CATALOG_NPM_REGISTRY` 可换镜像）
- [x] CLI：`sync dsh-catalog [--ref BRANCH] [--dry-run]`；脚本 `backend: sync:dsh-catalog`、root: `data:sync:dsh-catalog`
- [x] `shared/plugin-categories.ts` 补 `wsl`/`identity`/`agi`
- [x] `deploy.yml`：曾接入 daily/window 模式；GH #30 后生成的目录快照改为本地构建产物，不再提交
- [x] 单测 10 例（tar 解析、目录挑选、校验 floor、原子写/失败不动旧数据）；实测同步 7886 插件、stars overlay 7407 条、`plugins.json` 重新导出
- [x] AGENTS.md 更新（命令表 + /dsh 数据段）

## 结论

调研通过并落地：一条命令 `bun run data:sync:dsh-catalog`（CI 每日自动跑）即可保持 vendored 目录与上游同步，坏包校验保证不会写坏已提交快照。后续若上游 npm catalog 补齐 screenshots，可考虑整体切到 npm 源。
