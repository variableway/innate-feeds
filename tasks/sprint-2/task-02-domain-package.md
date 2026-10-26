# T2：新建 @innate/domain-dsh 域插件包（dsh/）

> Issue: 待建 · 依赖：T1 · Sprint: [sprint-2](./context.md)

## 目标

顶层新目录 `dsh/`，建成满足 `scanDomains` 契约的自包含域插件包。**本任务只增不删**（frontend 内 /dsh 原样保留，删减在 T3），保证落地即可构建。

### 包骨架（对齐 frontend/ 的域侧结构）

```
dsh/
├── package.json          # @innate/domain-dsh, main/types: src/index.ts,
│                         #   deps: @innate/ui ^0.1.0? （按实际 import 决定）, tanstack router, lucide-react,
│                         #         react-markdown 系（markdown-body 用）, pluginOrder: 30
├── plugin.json           # innate.plugin.v1, kind: domain, id: dsh, entry: src/index.ts,
│                         #   outlet: app, capabilities: [navItems, homeTile]
├── tsconfig.json         # @/* → src/*, @innate/shared/plugin-categories → ../../shared/plugin-categories.ts
└── src/
    ├── index.ts          # export { webDomain }
    ├── web-domain.tsx    # createWebDomain("dsh")：/dsh、/dsh/categories、/dsh/categories/$slug、
    │                     #   /dsh/plugins/$slug 四条路由（路径保持不变）+ navItems/homeTile
    ├── pages/            # page.tsx / categories-page.tsx / category-page.tsx / detail-page.tsx（迁自 frontend）
    ├── components/       # plugin-card / plugin-listing / plugin-list-item
    │                     #   + vendor：markdown-body、copy-install-button（feeds 侧原件保留）
    ├── services/plugins.ts   # 迁自 frontend（API + 静态模式镜像搜索）
    └── types/            # plugin.ts、dsh.ts
```

### 接线

- 根 `package.json` `workspaces` 与 `pnpm-workspace.yaml` 增加 `dsh`。
- navItems：dsh 域声明自己的 "Plugins"（group "DeepSeek Harness"）；homeTile：title "DSH Plugins"（T3 组合后 feeds 的同名 navItem 删除）。
- 分类常量**不迁**（留 `shared/`，见 research §4.2-4）。

## 验收记录

- [x] `cd dsh && bun run typecheck` 通过（package.json 配 typecheck 脚本 + typescript devDep）—— 首轮发现 tsconfig paths 深度写错（`../../`→`../`）与缺 vite-env.d.ts，已修复
- [x] 契约自检：用基础仓真实 `scanDomains`（innate-fe-cli/src/lib/registry.ts）对临时 domains 目录实测 → `{id:"dsh", packageName:"@innate/domain-dsh", pluginOrder:30, hasStyles:false}`（hasStyles=false 属预期：主题由宿主提供）
- [x] 根 `pnpm install` 成功识别新 workspace 成员（注意：CI 走 package.json `workspaces` 字段，pnpm-workspace.yaml 是本地未跟踪文件）
- [x] frontend 未被改动（本任务不动 frontend）
