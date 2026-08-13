# Feature: ui-shell

**Status:** done  
**Issues:** [ui-layout](../issues/ui-layout.md)

## 说明

三栏布局：Sidebar（可折叠）/ 分类栏 / 内容区；按页面组织 frontend 目录。

**演进（proposed，见功能文档，尚未实现）：**

- Digest 模式：`AppSidebar` 增加带独立图标的 Digest 入口；第二栏换为 `DigestSidebar`（非 CategoryPanel 第三项）—— [feeds-issues-digest.md](./feeds-issues-digest.md)
- Feeds 详情：主区 master-detail（左列表 / 右 README 或 iframe）—— [repo-detail-panel.md](./repo-detail-panel.md)

## 验收

- [x] Task 1–3（见 issue ui-layout）
- [x] trending、starred 路由与共用 components

## 相关代码

- `frontend/src/pages/`、`components/`、`router.tsx`
