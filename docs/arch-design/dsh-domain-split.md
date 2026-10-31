# DSH 插件目录域化拆分（sprint-2）

> Issue: [variableway/innate-feeds#13](https://github.com/variableway/innate-feeds/issues/13) · 日期：2026-10-26 · 状态：**已实施**
> 前置：[innate-fe-plugin-migration.md](./innate-fe-plugin-migration.md) §6-4（当时「dsh 先合入 feeds 域，体积大再拆」——本拆分即该伏笔的兑现）
> 完整调研与决策记录：[`tasks/sprint-2/research/dsh-domain-split.md`](../../tasks/sprint-2/research/dsh-domain-split.md)

## 结果布局

| 层 | 位置 | 说明 |
|---|---|---|
| dsh 域插件 | `dsh/`（`@innate/domain-dsh`，pluginOrder 30） | /dsh 四页自包含域包；`src/index.ts` 导出 `webDomain`；内部全相对导入（tsc paths 是 program 级全局，跨包别名会错解析） |
| datasource | `backend/src/dsh/`（catalog / routes / export） | market catalog / YAML 兼容加载 + 搜索、`/api/plugins*` Hono 子应用（server.ts 挂载）、`plugins.json` 静态导出（export-incremental 调用）——域包不持有数据逻辑 |
| 数据 | `~/.innate/awesome-dsh/plugin-catalog.json`（GH #30，本地不提交） | 上游 market index + GraphQL Stars 刷新；旧 YAML 仍为 fallback |
| 分类常量 | `shared/plugin-categories.ts`（不动） | backend 与 dsh 域共用；dsh 以相对导入消费 |
| feeds 域 | `frontend/`（瘦身） | 删 /dsh 路由与 navItem；`markdown-body` / `copy-install-button` 保留自用（dsh 侧为 vendor 副本） |
| standalone 宿主 | `frontend/src/main.tsx` + `host-shell.tsx`（host-only） | `collectWebDomainRoutes` 把 feeds + dsh 双域挂同一根路由；`collectNavItems` 聚合导航——单站体验与 URL 不变 |
| 构建工具链 | `frontend/scripts/build.ts` / `dev.ts` | Tailwind oxide 扫描源追加 `../dsh/src`；dev watch 同步追加 |
| 已删除 | `dsh-plugin-directory/`（Next.js 原型死代码） | — |

## 关键约束（改这块代码前先读）

1. **域包必须自包含**：innate-fe `gen` 整目录拷贝、不解析仓内依赖；除 npm 依赖与 `@innate/*` 外不得有跨包导入（shared/ 的相对导入是已知遗留，与 feeds 域 P3 一并解决）。
2. **frontend/package.json 不得声明 `@innate/domain-dsh`**：`@innate/* + workspace:` 协议会被 `innate-fe-cli install` 的 rewriteWorkspaceDeps 拒绝；宿主以相对导入 `../../dsh/src/index` 消费（host-only 文件，不进打包面）。
3. **tsc paths 是 program 级全局**：任何被 frontend typecheck 拉入 program 的包内不要用 `@/` 别名（用相对导入）。

## innate-fe 侧登记（P3 时用，与 feeds 同批）

```yaml
# plugins.registry.yaml
profiles:
  feeds-dsh:
    domains:
      - id: feeds
        from: ../innate-feeds/frontend
      - id: dsh
        from: ../innate-feeds/dsh
    iframes: []
```

契约自检已用基础仓 `scanDomains` 真机验证（id=dsh, pluginOrder=30, hasStyles=false——主题由宿主提供）。
