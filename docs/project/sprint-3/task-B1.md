# task-B1：AIHot token 叠加

## 计划（开工前）

- 做什么：`frontend/src/styles.css` 叠加 AIHot 扩展 token（来自 references/AIHOT/apps/web/app/app.css）：ink/ink-2/3/4 文字四阶、hot/hot-soft 强调、rank-1/2/3/rest 榜单色阶、radius 六档（mark/control/tile/card/panel/sheet）、--page-max-reading；暗色同步。
- 功能点：①shadcn 既有 token 零改动（叠加不推翻）②新 token 可被 Tailwind 类引用（text-ink-3、bg-hot-soft、text-rank-1、rounded-tile）③暗色完整。
- 如何验证：typecheck 绿；`bun run build` 后 dist CSS 中 grep 到 `--color-rank-1` 等新 token；页面 curl 200 无样式错误回归（shadcn 组件页面 /dsh 仍正常）。

## 完成回填（完成后）

- 做了什么：
- 完成的功能：
- 验证证明：
