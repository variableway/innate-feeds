# Issue: refactor-plugin-mode

**Status:** done  
**Source:** [variableway/innate-feeds#2 refactor项目](https://github.com/variableway/innate-feeds/issues/2)  
**Opened:** 2026-10-22 · **Assignee:** —  
**Feature:** —（架构迁移，见方案文档）

## 背景

Issue #2 要求：① 分析 datasource 与前端是否分离；② 若已分离，通过 innate-fe-cli 迁移、去除基础 UI、支持 plugin 模式。

已决策约束：**innate-feeds 保持独立仓**（不合并进 innate-fe），但保留插件能力；插件走 **轨道 A（domain）**；**彻底去壳**（本仓不再自带 sidebar/header 壳）。

## 交付物

- [x] [datasource-frontend-separation.md](../../arch-design/datasource-frontend-separation.md) — 分离分析（结论：已满足）
- [x] [innate-fe-plugin-migration.md](../../arch-design/innate-fe-plugin-migration.md) — 迁移方案 + 实施状态
- [x] P0：`packages/web-domain`、`packages/ui`、`shared`→`@innate/shared`
- [x] P1：`frontend` = `@innate/domain-feeds`，`webDomain` 导出 + `plugin.json`
- [x] P2：去壳（sidebar/header/主题/`components/ui`），原语收口 `@innate/ui`
- [x] P4：最小独立宿主；typecheck / test(34) / build 全绿

## 后续

- P3：innate-fe 侧 `plugins.registry.yaml` 登记本仓 + `gen` 联调（需该仓配合）
- 依赖策略可从 vendored 包切换为私有 registry 版本号

## 结论

分离已满足；domain 插件能力已就位，可被 innate-fe-cli 以轨道 A 接入。详见 [过程记录](../tasks/issues/refactor-plugin-mode.md)。
