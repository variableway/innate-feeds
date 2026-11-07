# task-B8：AIHot 配色整体迁移 + 图标语言对齐

## 计划（开工前）

- 做什么：`frontend/src/styles.css` 的 shadcn 语义 token 值整体替换为 AIHot 调色板（亮：纸感底 #faf9f6 / 面白 / teal accent #176b75 / 线 #dfe4e1 / sidebar #fdfdfb；暗：#13191c 底 / cyan accent #12ccd8 / 白 8% 线）；Trending 导航图标 Github → Flame（AIHot 热点语言）。
- 功能点：①shadcn 组件全量继承 AIHot 色感（换值不换名）②亮暗两套完整③既有 ink/hot/rank 扩展 token 与新底色一致（同源拷贝）④图标语义对齐（Flame=热点）。
- 如何验证：typecheck + build 绿；dist CSS 含 #faf9f6 / #176b75 / #12ccd8；页面 200 无回归；bundle 含 Flame 图标。

## 完成回填（完成后）

- 做了什么：`styles.css` 亮色块 28 个 token、暗色块 27 个 token 值替换为 AIHot 调色板（亮 #faf9f6/#176b75/#dfe4e1/#fdfdfb、暗 #13191c/#12ccd8/白 8% 线；--radius 0.625→0.75rem 对齐 AIHot card 12px；destructive 顺带用 hot 色系）；`web-domain.tsx` Trending 图标 `Github` → `Flame`。
- 完成的功能：①全站 shadcn 组件继承 AIHot 色感（token 名未动，B1 扩展层同源一致）②亮暗完整③热点图标语义对齐 AIHot（Flame）。
- 验证证明：`bun run typecheck` 绿；VITE_STATIC_MODE 构建通过且 dist CSS 含 `faf9f6/176b75/12ccd8`；重启 dev 后 //trending//edu//edu/videos//dsh 全 200；`/__dev_main.js` 含 `"Flame"` ×2。提交 **b585d2c**。
