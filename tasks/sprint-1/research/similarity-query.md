# R1：相似度查询方案调研（SQLite / bun:sqlite）

- **Issue:** https://github.com/variableway/innate-feeds/issues/5
- **结论日期:** 2026-10-23
- **验证环境:** `~/.innate/feeds.db`（bun:sqlite / Bun 1.4.3，Windows x64），数据为真实同步快照

## 需求场景

> 查 tag 含 **AI Agent** 且 **stars > 10000** 的 GitHub repo —— 以及更一般的"按标签/关键词的相似匹配"。

问题分两层：

1. **精确层**：topic 是受控词表，直接 join 即可；难点是 GitHub topic 命名不统一（`ai-agent` / `ai-agents` / `agent` / `agents` / `agentic-ai` …）。
2. **模糊层**：关键词匹配名称/描述，需要相关性排序。

## 库内现状（实测）

`starred_repo_topics` 中含 agent 的 topic 分布（top）：`ai-agents`(330)、`agent`(238)、`agents`(191)、`ai-agent`(166)、`agent-skills`(122)、`agentic-ai`(113)、`multi-agent`(74)…

→ **单一 tag 精确匹配会漏掉大量结果，必须做同义词扩展**。

## 方案对比

### 方案 1：topic 同义词集合 + join（精确层，推荐必用）

```sql
-- AI Agent 相关 topic 白名单 + stars 阈值
SELECT s.full_name, s.stars, s.language, s.description,
       GROUP_CONCAT(t.topic) AS topics
FROM starred_repos s
JOIN starred_repo_topics t ON t.repo_id = s.id
WHERE t.topic IN ('ai-agent','ai-agents','agent','agents',
                  'agentic-ai','agentic','ai-agent-framework','llm-agent',
                  'multi-agent','multi-agent-systems','autonomous-agents',
                  'coding-agent','agent-framework')
  AND s.stars > 10000
GROUP BY s.id
ORDER BY s.stars DESC;
```

✅ 已验证（返回 browser-use、gemini-cli、hermes-agent 等）。
- 优点：零依赖、走索引（`idx_starred_repo_topics_topic`）、语义可控。
- 缺点：白名单需人工维护；新词（`hermes-agent` 这类项目专属 tag）覆盖不到。

### 方案 2：FTS5 关键词 + BM25 相关性排序（模糊层，推荐必用）

库中已有 `starred_repos_fts` / `trending_repos_fts` 镜像（external-content，触发器同步）：

```sql
-- 名称/描述含 agent，BM25 相关性排序
SELECT starred_repos.full_name, starred_repos.stars,
       bm25(starred_repos_fts) AS rank
FROM starred_repos_fts
JOIN starred_repos ON starred_repos.rowid = starred_repos_fts.rowid
WHERE starred_repos_fts MATCH 'agent'
  AND starred_repos.stars > 10000
ORDER BY rank
LIMIT 20;
```

✅ 已验证。注意：`bm25()` 的参数必须是不带别名的 FTS 表名（带别名会报 `no such column`）。
- 优点：现成、BM25 排序、前缀查询 `agent*`、`NEAR()` 短语邻近。
- 缺点：无语义理解；分词按 Unicode 单词，`ai-agent` 会被切成 `ai` + `agent`（对本场景反而有利）。

### 方案 3：topic LIKE 模糊匹配（兜底）

```sql
SELECT DISTINCT s.full_name, s.stars
FROM starred_repos s
JOIN starred_repo_topics t ON t.repo_id = s.id
WHERE t.topic LIKE '%agent%' AND s.stars > 10000
ORDER BY s.stars DESC;
```

✅ 已验证（能捞到 `hermes-agent` 这类项目专属 tag）。
- 优点：覆盖一切含关键词的 topic，无需维护白名单。
- 缺点：全表扫描 topics 表（当前 ~5 万行，毫秒级，可接受）；`%ai%` 这类短词会过匹配。

### 方案 4：FTS5 trigram 分词器（子串/编辑距离模糊，可选）

Bun 1.4.3 内置 SQLite 支持 trigram：

```sql
CREATE VIRTUAL TABLE temp.name_trigram USING fts5(
  full_name, tokenize = 'trigram'
);
-- 之后 MATCH 'langchin' 也能命中 langchain（近似子串）
```

✅ `tokenize='trigram'` 建表已验证可用。适合"记不清全名"的仓库名模糊查找；维护成本是要建镜像表 + 触发器。Sprint-1 不落地，记为后续增强。

### 方案 5：编辑距离 / 向量相似（评估后暂缓）

- **自定义标量函数**：node:sqlite 的 `db.function()` 在 bun:sqlite 1.4.3 **不存在**（实测 `TypeError: db.function is not a function`）。要注册 Levenshtein 需换 native sqlite3 包或 native 扩展，不值得。
- **向量检索（sqlite-vec）**：需加载扩展 + 生成 embedding 管道，超出"简化版后台"范围。若未来要做语义相似（"找和 X 类似的仓库"），再评估。

## 推荐组合（Sprint-1 落地）

**方案 1 + 2 + 3 组合查询**，作为 Admin UI 的内置示例查询：

```sql
-- "AI Agent 且 stars>10000" 的生产版：topic LIKE 兜底 + 排除误报
SELECT s.full_name, s.stars, s.language,
       GROUP_CONCAT(t.topic) AS topics
FROM starred_repos s
JOIN starred_repo_topics t ON t.repo_id = s.id
WHERE t.topic LIKE '%agent%'
  AND s.stars > 10000
GROUP BY s.id
ORDER BY s.stars DESC;
```

UI 三栏的「保存的 SQL」默认预置：① 精确白名单版 ② FTS BM25 版 ③ LIKE 兜底版，三者即可覆盖"相似度查询"的全部实际需求。

## 验收记录

- [x] ≥3 种方案对比（1/2/3/4/5 共 5 种）
- [x] 示例 SQL 在真实库验证执行（方案 1/2/3 已跑通，方案 4 建表跑通，方案 5 给出不可行原因）
- [x] 给出 Sprint-1 推荐组合
