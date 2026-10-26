# T4：死代码清理与 CI/文档/Pages 收口

> Issue: 待建 · 依赖：T3 · Sprint: [sprint-2](./context.md)

## 目标

1. **删除 `dsh-plugin-directory/`**（Next.js 原型死代码；workspaces/CI/docs 均无引用，删除前再 grep 确认一次）。
2. **CI**：`.github/workflows/ci.yml` 增加 dsh typecheck（deploy.yml 无需改——Pages 产物仍由 frontend 宿主单站构建）。
3. **文档**：
   - `AGENTS.md`：仓库地图删 `dsh-plugin-directory/`、加 `dsh/` 与 `backend/src/dsh/`；「Where to make changes」表更新 dsh 相关行。
   - `docs/arch-design/`：新增或在迁移文档追加 sprint-2 拆分记录（含 innate-fe 侧登记片段，research §6）。
4. **静态/Pages 验证**：`bun run build:static` 产物含 `plugins.json` 与 /dsh 路由 bundle；`bun run preview` 抽查 /dsh 页面可用（静态模式走客户端镜像搜索）。

## 验收记录

- [x] `dsh-plugin-directory/` 已删（-6k 行），全仓无引用残留
- [x] CI workflow 更新（ci.yml 加 "Type check dsh domain" 步骤；目检 + 与现有步骤同构）
- [x] AGENTS.md / docs 更新：仓库地图与 where-to-change 表更新；新增 `docs/arch-design/dsh-domain-split.md`（含 innate-fe registry 登记片段）；迁移文档 §6-4 标注已拆分。README 项目结构同步
- [x] `bun run build:static` + preview 验证：plugins.json 导出 2716 条（3.9MB），preview `/`、`/dsh`、`/data/plugins.json` 全 200，静态 bundle 含 "Awesome DSH Plugins"
- [x] 全部 typecheck（backend/frontend/dsh 三包）+ `bun test`（41/41）+ format:ts:check 通过；分支推送后以 CI 运行为准
