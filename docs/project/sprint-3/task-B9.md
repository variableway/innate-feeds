# task-B9：「主题」主导航组——Education 入驻，ui/ux 等主题排队

## 计划（开工前）

- 做什么：edu 域 navItems 的 group 由 "Education" 改为「主题」；host-shell GROUP_ICONS 增加「主题」组图标（Layers）；「主题」成为侧栏一级分组，Education 三项（Skills/Videos/Categories）挂其下。ui/ux 等未来主题按 topics/<id>/ 域包机制陆续入驻（topics/ 包机制已就绪，新增即自动进 workspace 与 Tailwind 扫描）。
- 功能点：①「主题」一级菜单组出现且含 Education ②组图标 Layers ③nav-visibility 继续放行 /edu* ④为后续主题（ui/ux…）预留结构性位置。
- 如何验证：侧栏出现「主题」组含 3 项；/edu 系列页 200；typecheck/build 绿。

## 完成回填（完成后）

- 做了什么：`topics/edu-animate/src/web-domain.tsx` 三处 `group: "Education"` → `group: "主题"`；`frontend/src/host-shell.tsx` GROUP_ICONS 增 `主题: Layers`（lucide import 补 Layers，修复过程中一次双逗号语法错导致 dev 崩溃，即时发现修复并重启）。
- 完成的功能：①侧栏出现「主题」一级组（Layers 图标），Education 三项挂入②ui/ux 等后续主题的挂入点已就位——topics/<id>/ 域包机制（workspace `topics/*`、Tailwind 扫描、nav group 约定）③nav-visibility 无需改动（/edu 前缀本就放行）。
- 验证证明：/edu、/edu/videos 200；typecheck 绿；静态构建通过；重启 dev 后五页全 200。提交 **043228b**。
