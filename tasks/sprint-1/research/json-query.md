# R2：JSON 文件 SQL 查询方案调研

- **Issue:** https://github.com/variableway/innate-feeds/issues/6
- **结论日期:** 2026-10-23
- **验证环境:** bun:sqlite（Bun 1.4.3），真实文件验证

## 需求场景

> 所有 JSON 文件放一个地方，直接通过 SQL 查询文件内容，用表格方式展示。

本仓的 JSON 数据面：外部收集器（Product Hunt / YC / a16z / GitHub Topics）写入 `~/.innate/<source>/*.json`（见 `docs/arch-design/external-collectors.md`），静态导出数据在 `frontend/public/data/`。这些数据目前只能整文件读，无法查询。

## 方案对比

### 方案 A：SQLite JSON1 + "文件注册表"内存表（✅ 推荐，已验证）

bun:sqlite 内置 JSON1（`json_extract` / `json_each` / `json_valid` / `->` / `->>` 运算符全部可用）。做法：

```sql
-- 1. 注册表：一次扫描，把目录下所有 .json 文件装进内存表
CREATE TABLE json_documents (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE,     -- 相对/绝对路径
  name TEXT,            -- 文件名
  content TEXT          -- 文件全文
);

-- 2. 按文件为粒度查询
SELECT name, json_extract(content, '$.name') AS pkg
FROM json_documents WHERE json_valid(content);

-- 3. 展开为行级（表格展示天然适配）
SELECT je.key, je.value, je.type
FROM json_documents jd, json_each(jd.content) je
WHERE jd.name = 'package.json';

-- 4. 现代运算符写法
SELECT name, content ->> '$.version' AS v
FROM json_documents WHERE content ->> '$.type' = 'module';
```

✅ 实测全部跑通（注册 2 个真实 package.json，`json_each` 展开 7 个顶层 key，`->>` 过滤正确）。

- 优点：零新依赖；与 admin 后台同一 SQLite 引擎，一张表搞定；`json_each` 天然把嵌套结构变成表格行；只读连接里建 `TEMP` 表即可，不污染主库。
- 缺点：大文件全量进内存（加 1MB 上限过滤）；无二级索引（文件量级 < 1000 无所谓）。

**落地要点（T3 采用）：**
1. 扫描目录默认 `~/.innate`，环境变量 `ADMIN_JSON_DIR` 可覆盖；递归、跳过 `node_modules`/隐藏目录/`secrets`，单文件上限 1MB。
2. `POST /api/admin/db/json/scan` 重建注册表；注册表建在**只读查询连接的 temp store**（`CREATE TEMP TABLE`），主库零写入。
3. UI 提示用户可对 `json_documents` 跑 `json_each` 查询。

### 方案 B：DuckDB `read_json_auto`（不采用）

`SELECT * FROM read_json_auto('~/.innate/*/*.json')` 体验极好（自动推断 schema、直接聚合嵌套数组）。但引入 DuckDB = 新增 ~50MB 原生依赖 + 独立进程/驱动 + Windows 侧载问题，与"简化版后台"定位冲突。**若未来需要复杂 JSON 分析再评估。**

### 方案 C：Datasette / sqlite-utils（不采用）

Datasette 是现成的"SQLite + JSON 浏览器"，`sqlite-utils insert-files` 可把文件元数据入表。但它是独立 Python 服务，与现有 Hono 后端重复，且无法复用本仓的 Feeds 业务查询。仅作为灵感来源（其 `files` 表设计被方案 A 借鉴）。

### 方案 D：每文件一张视图（不采用）

为每个 JSON 文件按其结构动态 `CREATE VIEW`（顶层 key → 列）。灵活但脆弱：结构推断代码量大、异构文件易崩。方案 A 的 `json_each` 已达到同样的"表格展示"效果。

## 结论

采用 **方案 A**：`json_documents` 注册表 + JSON1 函数。T3 按上述落地要点实现；T4 的 UI 结果表格直接渲染 `json_each` 查询输出即为"表格方式展示"。

## 验收记录

- [x] 多方案对比（A/B/C/D）
- [x] 推荐方案在真实数据上验证（注册 + json_extract + json_each + ->> 全跑通）
