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

- [ ] `dsh-plugin-directory/` 已删，全仓无引用残留
- [ ] CI workflow 更新后语法自检（actionlint 或目检）
- [ ] AGENTS.md / docs 更新（含登记片段）
- [ ] `bun run build:static` + preview 验证 /dsh 静态可用
- [ ] 全部 typecheck + `bun test` 通过；推分支后 CI 绿
