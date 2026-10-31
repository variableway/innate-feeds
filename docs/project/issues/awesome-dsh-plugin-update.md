# Issue: awesome-dsh-plugin-update

**Status:** done（GH #30：awesome/deepseek DSH plugin 目录更新 + Stars 排名）  
**Source:** [variableway/innate-feeds#30 aweseme deepseek plugin 内容需要可以更新](https://github.com/variableway/innate-feeds/issues/30)  
**Opened:** 2026-10-30 · **Completed:** 2026-10-31 · **Assignee:** codex  

## 背景

`/dsh` 原先只加载 vendored YAML 快照，上游新增插件后必须手动复制整个 `data/` 目录。
同时 `stars.json` 的时间戳停留在旧快照，默认的 Stars 排名会逐渐失真。

## 方案

### 数据来源

- **主源：** 上游站点发布的 format-1 market index  
  `https://awesome-dsh-plugin.com/index.json`
- **补充：** GitHub GraphQL `repository.stargazerCount`，每批 100 个仓库
- **兼容源：** 旧 `data/plugins/*.yml` 仍保留为 `plugin-catalog.json` 缺失时的 fallback

选择 market index 的原因：它比仓库 tarball / 上千个 YAML 单文件请求更小、更稳定，
并直接携带分类、双语文案、npm 包和发布时间。

### 更新机制

1. 校验并拉取 market index。
2. 归一化为现有 `/api/plugins` 与静态 `plugins.json` 共用的目录模型。
3. 复用可按 repository URL 匹配的旧 screenshots。
4. 用 GitHub GraphQL 刷新 Stars；无 token 时保留上次值。
5. 写入本机 `~/.innate/awesome-dsh/plugin-catalog.json`，Pages deploy 再导出
   `frontend/public/data/plugins.json`。
6. GitHub Actions 在 daily/window 数据同步后执行 `sync awesome-dsh`。

### Trendshift 增量

Trendshift 已有归档式增量：每个 `timeframe/language` 切片按 `periodKey` 保存历史期次，
当前采集结果由 `mergeSliceRows()` 以 `(periodKey, fullName)` 合并；incoming 覆盖同一 key，
历史期次继续保留。该结论保持不变。

## 交付物

- [x] `backend/src/collector/awesome-dsh.ts`：market index 归一化 + GraphQL Stars + 本地 catalog 写入（不提交）
- [x] `backend/src/dsh/catalog.ts`：优先加载 `plugin-catalog.json`，保留 YAML fallback
- [x] CLI：`sync awesome-dsh` / `bun run sync:awesome-dsh`
- [x] Pages deploy：daily/window 自动同步；生成的目录只用于构建，不提交回仓库
- [x] 分类从 20 扩展到 23（新增 `agi`、`identity`、`wsl`）
- [x] OpenAPI 插件 schema / 分类文档同步
- [x] 单元测试：归一化、npm 安装命令、去重 slug、无效项过滤
- [x] 数据刷新：3,992 个插件条目（覆盖 3,832 个 GitHub 仓库）与最新 Stars 快照

## 验证

- `bun test backend`
- `backend` / `frontend` / `dsh` typecheck
- `frontend` production build
- `sync awesome-dsh` 实测：3,992 plugin entries / 3,832 repositories / 3,807 resolved star lookups（25 个已删除或私有仓库被跳过）/ GraphQL remaining 4,925
- 默认 `/dsh` 查询按 `stars.desc` 排名
