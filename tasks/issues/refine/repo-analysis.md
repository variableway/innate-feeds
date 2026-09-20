# Repo Analysis

## Task 1: SQLite 数据库 ✅(2026-09-20 完成)

### 1. SQLite 数据库是否可以直接放到当前目录中

**结论:可以。**`DB_PATH` 环境变量本来就支持任意位置,本次改造后相对路径确定性锚定到仓库根目录,且已被 gitignore 覆盖(见第 2 条)。

用法(相对路径一律相对仓库根,与从哪个目录启动无关):

```bash
# 临时:仓库根生成 <repo>/feeds.db
DB_PATH=feeds.db bun run dev:backend

# 固定:写入 backend/.env(bun 自动加载,后端启动脚本 cwd=backend)
echo 'DB_PATH=feeds.db' >> backend/.env

# 子目录 / 绝对路径均可,父目录不存在会自动创建
DB_PATH=backend/feeds.db bun run dev:backend
DB_PATH=/somewhere/else/feeds.db bun run dev:backend
```

本次代码改动(`backend/src/db/paths.ts`):

- 原实现中相对 `DB_PATH` 按 `process.cwd()` 解析——从仓库根和 `backend/` 启动会落到**不同文件**,是个 footgun。
- 现在从模块位置向上查找声明 `workspaces: [... "backend"]` 的 `package.json` 作为仓库根(源码运行 `backend/src/db` 与打包产物 `backend/dist` 两种位置都能找到),找不到时回退 cwd(保持旧行为)。
- `DB_PATH` 指向的父目录不存在时自动创建。
- 默认值不变:仍为 `~/.innate/feeds.db`(`INNATE_HOME` 可整体迁移)。**建议保持此默认**——现有数据在 `~/.innate`、可多项目共享、彻底避免误提交;仓库内 DB 作为本地 opt-in。
- 连带效应已确认:`hidden.json` 存在 DB 同目录(`hidden-store.ts`),会跟着 DB 移动,已补充 gitignore(见下)。

### 2. SQLite 数据库需要被 gitignore 掉

**结论:原本已覆盖,本次验证并补强。**

- 验证 `git check-ignore`:仓库根、`backend/`、任意子目录下的 `feeds.db`、`feeds.db-wal`、`feeds.db-shm` 均命中既有规则(`*.db` / `*.db-wal` / `*.db-shm` / `*.db-journal` / `backend/feeds.db*`)。
- 验证 `git ls-files`:当前没有任何 db 文件被 git 追踪。
- 本次补充:
  - `*.sqlite` / `*.sqlite-journal` / `*.sqlite-shm` / `*.sqlite-wal`(防将来换扩展名);
  - `/hidden.json` 与 `backend/hidden.json`(DB 放进仓库时,同目录的 hidden.json 运行时文件也需要忽略)。

### 3. 本地运行默认走数据库,可以做查询;是否可能进行相似度查询?

**现状确认:**本地 API 模式默认走 SQLite(`bun:sqlite`,WAL 模式),已支持 `language` / `topics` / `search` / `sort` / `order` / `date` / `starsMin`/`starsMax` / 分页过滤。当前本地库规模:226 个 trending 仓库、6628 个 starred、883 条 trending topics。

**相似度查询可行性(以下均在本机实测,Bun 1.3.11 + SQLite 3.51.0):**

| 方案 | 可行性 | 说明 |
|---|---|---|
| FTS5 关键词相关度 | ✅ 开箱可用 | Bun 内置 SQLite 编译带 `ENABLE_FTS5`,BM25 排序、前缀匹配可用;建虚表 + 触发器同步即可,零新增依赖,可直接替换现有 `LIKE` 子串搜索 |
| sqlite-vec 向量扩展 | ❌ 当前不可用 | `bun:sqlite` 的 `loadExtension` 编译时被禁用(报错 "This build of sqlite3 does not support dynamic extension loading");`setCustomSQLite` 指向系统 `/usr/lib/libsqlite3.dylib` 同样失败。要上需换 `better-sqlite3`(支持 loadExtension,但参数绑定 `@` 前缀等需改回)或自编译 SQLite |
| 纯 JS 暴力 KNN | ✅ 规模完全够 | embedding 存 SQLite BLOB、读入 `Float32Array` 内存全扫:6628 仓库 × 384 维余弦全量扫描实测 ~36ms;10 万级也仅几百 ms,到那之前不需要向量索引 |

**前置条件:**语义相似度(同义、跨语言)必须先有 embedding 源——把 `description + topics + language` 拼文本,走 embedding API 或本地模型,这是主要工作量;存储和检索本身在本规模下都是小问题。

**建议路线:**

1. 短期:上 FTS5(BM25)替换 `LIKE`,搜索相关度立刻提升,零依赖;
2. 需要语义相似时:embedding + JS 内存 KNN(上面实测的路线);
3. sqlite-vec 仅在数据量上到几十万、且愿意把驱动换回 `better-sqlite3` 时再评估。

### 4. FTS5 已上线(2026-09-20)

按上面建议路线第 1 步实施完毕,`LIKE '%...%'` 子串搜索已全部替换为 FTS5 BM25 相关度搜索。

**实现方式(4 个文件):**

- `backend/src/db/schema.sql` — 新增两张 external-content FTS5 虚表(`trending_repos_fts` / `starred_repos_fts`,索引 `name` + `full_name` + `description`)+ 各 3 个触发器(INSERT/UPDATE/DELETE)自动同步索引。数据仍只存主表,索引是镜像。
- `backend/src/db/index.ts` — `getDb()` 每次连接初始化时 `rebuild` 两个索引(当前 ~7k 行只要几毫秒,顺带自动回填 FTS5 出现之前的老库);新增 `toFtsQuery()` 把用户输入净化成安全的 MATCH 表达式(每个词变成带引号的前缀短语,标点不可能打爆语法);`getTrendingItems` / `getStarredItems` 搜索走 `MATCH` 过滤 + `bm25()` 排序。
- `backend/src/app/server.ts` — 一行:搜索且未显式指定 `sort` 时不再兜底 `"stars"`,把排序权交给 DB 层按 BM25 相关度输出。

**行为变化:**

| 场景 | 之前(LIKE) | 现在(FTS5) |
|---|---|---|
| `rust cli` | 0 结果(要求连续子串) | 8 结果(多词 AND,分列命中) |
| `vector database` | 5(要求整串出现在同一字段) | 9(两词分别命中也算) |
| `agent` 排序 | 按 stars | 名称命中的仓库排最前(BM25) |
| `repo` | 不匹配 `repositories` | 前缀匹配命中 |
| `c++` / 引号 / `AND` 等 | 可能拖垮或错配 | 净化后永不报语法错误 |
| 显式 `sort` 参数 | 生效 | 仍然生效(优先于相关度) |

已知取舍:`C++` 这类查询会被分词器降成 `c` + 前缀,命中偏多(标准分词行为);静态模式(GitHub Pages)的搜索仍是前端 JS 过滤,不在本次范围。

**实现过程中的两个坑(已注释在代码里):**

1. FTS5 的表级 `MATCH` / `bm25()` 不认表别名,必须用完整表名;
2. `bm25()` 只能在 MATCH 所在查询块内按行求值,trending 的 `GROUP BY` 聚合外层不能直接 `MIN(bm25(...))`——items 查询改为 JOIN 一个按行算好 rank 的子查询,并用 `LIMIT -1` 阻止 SQLite 子查询扁平化。

**验证:**合成数据 17 项断言(触发器同步 / upsert 更新 / 删除 / 前缀 / 多词 AND / 特殊字符 / BM25 排序 / 重连 rebuild)全部通过;真实库副本上与旧 LIKE 对比见上表;`bun run typecheck` 通过。

**使用方法(对使用者零变化):**API 形状不变,还是 `GET /api/feeds?type=starred&search=agent`。要按相关度排序,不要带 `sort` 参数即可(前端未选排序时本来就不传);带了 `sort=stars` 等则按显式排序。
