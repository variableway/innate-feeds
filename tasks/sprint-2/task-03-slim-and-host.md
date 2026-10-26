# T3：feeds 域瘦身 + 宿主双域组合

> Issue: [#16](https://github.com/variableway/innate-feeds/issues/16) · 依赖：T2 · Sprint: [sprint-2](./context.md)

## 目标

1. **feeds 域删 dsh**：`frontend/src/web-domain.tsx` 删 4 条 /dsh 路由与 "Plugins" navItem；删 `pages/dsh/`、`components/plugin-*.tsx`、`services/plugins.ts`、`types/plugin.ts`、`types/dsh.ts`（`markdown-body`、`copy-install-button` 保留——feeds 自用）；`tsconfig.json` 移除 plugin-categories paths/include（若无他人引用）。
2. **宿主组合双域**（host-only 文件，不进域打包面）：
   - `main.tsx`：自建 root route，把 feeds 与 dsh 两个 `webDomain` 的 route factory 都挂上（替代 `createStandaloneWebDomainRouter` 单域 API），basepath 逻辑保持。
   - `host-shell.tsx`：`domain` prop 改 `domains: WebDomain[]`，navItems 取并集按 group 归类（现有分组逻辑复用）。
   - dsh 域以相对导入 `../dsh/src` 进入宿主构建（frontend/package.json **不得**声明该依赖——`@innate/* + workspace:` 会被 install 改写器拒绝，见迁移文档 §4 注）。

## 风险点（research §5）

- `Bun.build` 对 `../dsh/src` 内 `@/*`、`@innate/shared/*` 别名的解析：先跑 `bun run build` 验证；失败则 build.ts 注入合并 paths 或 dsh 内改相对导入。

## 验收记录

- [x] `bun run dev` 起后：`/trending`、`/dsh`、`/dsh/categories`、`/dsh/plugins/<任一slug>` 均可导航渲染，左栏两个分组（GitHub / DeepSeek Harness）齐全 —— 双服务起后实测：内存路由组合逐路径匹配正确（/trending|/digest→feeds 域，/dsh|/dsh/categories|/dsh/plugins/$slug→dsh 域），dev bundle 含 6 处 dsh 路由串、CSS 含 dsh 专属类（aspect-[2/1]/object-top），/api 代理到抽离后的子应用正常
- [x] 全仓 grep：frontend 内无 `pages/dsh`、`plugin-card`、`services/plugins` 残留引用
- [x] `cd frontend && bun run typecheck`、`cd dsh && bun run typecheck`、`cd backend && bun run typecheck` 三包通过
- [x] `cd frontend && bun run build` 产物构建成功（含 dsh 代码，JS 含 "Awesome DSH Plugins"，20832 KiB total）
- [x] `bun test` 通过（41/41）

**实施备注（超出原方案的事实）：**
- Bun.build 对 `../../dsh/src` 相对导入与 dsh 内部相对导入解析正常，无需注入 tsconfig（风险未触发）。
- tsc 的 paths 是 program 级全局：dsh 内部 `@/` 别名被 frontend typecheck 拉入同一 program 时会错解析 —— 已把 dsh 包内部全部改为相对导入（含 shared/plugin-categories），dsh/tsconfig 不再需要 paths。research §4.2-4 的「tsconfig paths 映射」口径由「相对导入」落地。
- 宿主组合直接复用 `@innate/web-domain` 的 `collectWebDomainRoutes` / `collectNavItems`（原生多域 API），未手搓 factory 循环。
