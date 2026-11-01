# Issue: monid-integration

**Status:** done（调研；P1–P3 转后续任务）
**Source:** [variableway/innate-feeds#35 调研如何和 monid 结合使用](https://github.com/variableway/innate-feeds/issues/35)
**Opened:** 2026-11-01 · **Assignee:** claude（monid worktree）
**Feature:** —（调研报告，见下）

## 背景

Issue #35 要求调研 [qdriven/monid](https://github.com/qdriven/monid)（monid-ai/monid 的 fork，"OpenRouter for agent tools"）与 [qdriven/awesome-monid](https://github.com/qdriven/awesome-monid) 提供的服务如何与 innate-feeds 结合，含 MCP 协议相关生态（参照 smithery.ai），**写入文档**。

## 交付物

- [x] [monid-integration.md](../../research/monid-integration.md) — 调研报告：Monid 是什么（三动词/五接入方式/计费）、awesome-monid 与 Smithery 生态盘点、innate-feeds 三个结合方向（消费侧采集通道 / 供给侧 MCP 发布 / SKILL.md）、P0–P3 路线图、风险与开放问题
- [ ] P0：本机 Claude Code 接入 `https://mcp.monid.ai/v1` 试用（10 分钟，转日常操作）
- [ ] P1：`backend/src/collector/shared/monid.ts` 采集通道 + HF/PH 兜底（另开 issue）
- [ ] P2：`/api/mcp` MCP server + `/SKILL.md` + Smithery/awesome-monid 注册（另开 issue）
- [ ] P3：上游 connector PR；dsh 目录 MCP 数据源（可选）

## 关键结论

- Monid = agent 工具统一 HTTP 网关（2,000+ 端点，discover/inspect 免费、run 按次计费），**MCP（`mcp.monid.ai/v1`）与 SKILL.md 是它的两个官方接入面**，不是其本体；
- 结合点三方向：**消费侧**（替代/补充 Firecrawl，治 PH 静默 0 条、绕本机 HF 被墙）、**供给侧**（innate-feeds 自建 MCP server 优先于上游 connector PR）、**文档侧**（`/SKILL.md` 半天量级）；
- Smithery 的 MCP Proxy/托管身份 2026-10-31 已关停（注册表仍在）→ 发布渠道多元化，不自绑单一聚合站；
- 单次 run 成本 $0.0x 量级（awesome-monid 价格标签），日 sync 场景月成本个位数美元，可预算，但必须带限额与费用记录护栏。

## 结论

调研完成，方向与优先级已定（P0 零成本可立即执行）。P1/P2 按 §4 路线图另开 issue 立项。
