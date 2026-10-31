# GH #31 执行日志：本地数据更新 + 定时任务 + 数据源 review

## 2026-10-31（claude，qdriven/github-topic worktree）

**结论：** 三个子任务全部完成，另加 5 个新数据源 + Feeds 菜单。

1. **现状核查**：topics 本机从未同步（`~/.innate/github-topics` 不存在）、digest 停在 2026-07-29、`orca automations list` 为空、无数据源总览文档。
2. **采集器**（`backend/src/collector/`）：新增 `hackernews.ts`（Algolia front_page/按日 top）、`huggingface.ts`（api/trending + models 兜底）、`github-new.ts`（Search `created:>N stars:>10`）、`devto.ts`、`lobsters.ts`；`vc-portfolio.ts` 扩为 8 源编排（单源失败不中断，已验证 HF 超时被跳过）。normalizer 测试见 `external-collectors.test.ts`（8 用例）。
3. **digest**：`DIGEST_SOURCES` 增 `hellogithub`（521xueweihan/HelloGitHub，`[开源推荐]` issue 走通用解析器）；前端 4 处源定义同步更新。
4. **API/导出**：`data/external-store.ts` + `GET /api/external(/{source})` + openapi 注册；`data/export-external.ts` 挂进 `export-incremental`；`frontend/public/data/external/` 进 `.gitignore`。
5. **前端**：`/feeds` 总览 + `/feeds/$source` 明细（`pages/feeds/`、`components/external-item-card.tsx`、`services/external.ts` 双模式）；`web-domain.tsx` 增 `Feeds` nav group（总览 + 8 子菜单，meta 驱动）；`host-shell.tsx` 补图标。浏览器截图验证总览页与 HN/GitHubNew 明细页渲染正常（修复一处 `useParams` strict 匹配 bug，改用仓库既有的 `strict: false` 约定）。
6. **本地数据**：topics（21 topics / 804 repos）、digest（ruanyf 1836 + GitHubDaily 300 + HelloGitHub 652）、8 外部源 7 成功（HF 本机网络超时，CI 可达）。
7. **编排**：根 `data:update:local` 一键脚本；`deploy.yml` 增外部源同步步骤（Pages 也拿到新鲜数据）。
8. **文档**：`docs/arch-design/data-sources.md`（子任务 3 交付）；AGENTS.md 布局/命令/API/变更表更新。
9. **Orca 定时**：`innate-feeds-data-update`（id `a787bfaf`），每日 07:00 本机 `data:update:local`；手动试跑 run 1 **completed**（14:30–14:39），全链路通过：trending 15 / starred 2 / digest 2788 / topics 804 / YC 1003 / a16z 29 / HN 30 / GH-New 50 / Dev.to 50 / lobste.rs 25；HF 按预期超时跳过；全程零 git 操作。
10. **提交纪律**：只提交代码与文档；数据文件（chunks/external/readmes）不入库。

**遗留（非 #31 范畴）**：试跑发现 Product Hunt 无 Firecrawl key 时 HTML 兜底稳定 0 条（页面已纯 JS 渲染，见 data-sources.md 已知限制）；需配 Firecrawl API key 或改接 PH 官方 API。
