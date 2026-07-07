# Conventions: Innate Feeds

代码与 `docs/project/` 文档的写作约定。多 Agent 共享，勿在各工具 Rules 里重复。

## NGI 原则（写上下文时）

| 原则 | 含义 | 反例 |
|---|---|---|
| **N**ecessary | 只写必要信息 | 不写 package.json 里已有的依赖列表 |
| **G**rounded | 有据可查 | 不写「可能用 Redis」，写已决策或标「待定」 |
| **I**mmutable-ish | 相对稳定 | 不写「迭代第 3 天」，用 issue 状态追踪 |

## 代码规范

- 语言 / 格式化：TypeScript strict；Prettier（`bun run format:ts`）
- 目录约定：见 [overview.md](../overview.md) 代码仓目录结构
- 测试要求：暂无自动化测试套件；改动需 `typecheck` 通过

## Git 与多 Agent

- 每 Agent 独立分支：`feature/<issue-id>-<agent>`
- 不跨 issue 改文件；不并行改同一 issue
- 合并通过 PR；合并后更新 `features/` 与 task log

## Agent 工作约定

1. 会话入口：[`../index.md`](../index.md)  
2. 任务契约：[`../issues/`](../issues/README.md)  
3. 过程日志：[`../tasks/issues/`](../tasks/issues/) — **做完必追加一条**  
4. 禁止新建 `.agents/` 或第二套 spec 目录  

## 工具配置（L2）

供应商差异（MCP、模型）写在仓库根 `AGENTS.md` / `CLAUDE.md`，不写入本文件。
