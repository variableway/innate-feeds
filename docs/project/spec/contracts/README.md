# Contracts

跨模块、跨 Agent 的**接口约定**。Agent 之间不直接对话，通过本目录 + issue 对齐。

## 索引

| ID | 双方 | 文档 | 状态 |
|---|---|---|---|
| feeds-api-v1 | frontend ↔ backend | [feeds-api-v1.md](./feeds-api-v1.md) | active |
| admin-tables-api-v1 | admin UI ↔ backend | [admin-tables-api-v1.md](./admin-tables-api-v1.md) | draft |

## 变更流程

1. 在 issue 中提出合约变更  
2. 更新本目录对应 md，双方 Assignee 确认  
3. 在 `tasks/issues/<id>.md` 记录变更证据  

## 何时需要合约

- 水平拆分：API ↔ UI ↔ DB 边界  
- 流水线：上游产出格式交给下游  

垂直拆分（同一领域内多 issue）通常只需 issue + feature 文档。
