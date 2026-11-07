---
name: topic-discovery
description: 检索式 GitHub Topic 发现、相关性搜索与分层精选：从 starred 种子仓库提取真实 topic 词频与 lift 分层（业务层 vs 技术层），T1 共现 / T2 Jaccard / T3 GraphQL 三层相关性，再与 trendshift 势头交叉产出 topic 精选，用 CLI 同步并验证落盘。当用户要"找相关 topic"、"挖掘领域 topic"、"topic 精选/curation"、"扩充 topics 数据源"、"按领域搜索 Topic"、"topic discovery/search"时使用。
---

# topic-discovery：从 starred 数据出发的领域 Topic 检索

方法论（2026-11 对 starred 中 "UI/UX 设计→前端开发" Top 15 SKILL 的综合分析提炼）：
**不猜词，从数据提取；约束优于自由；每步可验证。**

- 种子仓库 → 真实 topic 词频（GitHub topic 是别人打好的标签，比关键词猜测可靠）
- 精确 topic 匹配优先；description 匹配必须防子串误伤（`%ui%` 会命中 b**ui**ld/g**ui**de）
- 同步后验证落盘，数量对不上就报告，不静默吞掉

## 数据事实

| 事实 | 位置 |
|---|---|
| starred 库 | `~/.innate/feeds.db`：`starred_repos`（id, full_name, stars, description, starred_at）+ `starred_repo_topics`（repo_id, topic） |
| topics 快照 | `~/.innate/github-topics/topics/{topic}.json` + `index.json`（已同步清单） |
| 同步命令 | `cd backend && bun src/app/cli.ts sync github-topics --topic X [--limit 50]`（可叠多个 `--topic`） |
| 已同步列表 | `cd backend && bun run topics:list`（或读 index.json） |

## 工作流（五步）

### 1. 种子集：精确 topic 匹配为主，name/desc 为辅

```sql
-- 领域词表来自第 5 节，替换 IN 列表即可
WITH seeds AS (
  SELECT DISTINCT r.id, r.full_name, r.stars
  FROM starred_repos r JOIN starred_repo_topics t ON t.repo_id = r.id
  WHERE t.topic IN ('ui','ux','design','design-system','css','frontend',
                    'tailwindcss','shadcn-ui','animation','accessibility',
                    'typography','components','component-library'))
SELECT count(*) FROM seeds;
```

需要扩大种子时才加 name 匹配，且必须加词边界：
`lower(r.full_name) REGEXP '[[:<:]](ui|ux|design|css|frontend)[[:>:]]'`
（macOS sqlite3 的 REGEXP 词边界写法可能是 `\b`，先小查询试一次再全量跑。）

### 2. 词频提取 + 停用词

```sql
WITH seeds AS ( /* 同上 */ )
SELECT t.topic, count(*) n
FROM seeds s JOIN starred_repo_topics t ON t.repo_id = s.id
WHERE t.topic NOT IN ('ai','llm','mcp','claude','claude-code','agent','agents',
                      'ai-agents','ai-agent','openai','anthropic','gemini',
                      'hacktoberfest','awesome','awesome-list','open-source','self-hosted')
GROUP BY t.topic ORDER BY n DESC LIMIT 25;
```

停用词表按需扩充：目标是滤掉与领域无关的泛热词。

> 用户问的是"与 X 相关的 topic有哪些"（relatedness）而不是"该领域哪些 topic 多"
> （frequency）时，转到 [相关性搜索](#相关性搜索三层由近及远) 一节。

### 3. 对照已同步清单去重

读 `~/.innate/github-topics/topics/index.json`，把候选 topic 标记为
`已同步` / `待同步`。前端参考（bun 一行）：

```bash
bun -e 'const j=require("/Users/patrick/.innate/github-topics/topics/index.json");console.log((j.topics||j).map(t=>t.topic||t.name).join("\n"))'
```

### 4. 挑选并同步

优先级：词频高 ∩ 领域核心 ∩ 未同步。一次不超过 5 个（GitHub Search API 限额友好）：

```bash
cd backend && bun src/app/cli.ts sync github-topics --topic design-system --topic tailwindcss --topic shadcn-ui
```

### 5. 验证与汇报

- 每个新 topic 断言 `~/.innate/github-topics/topics/{topic}.json` 存在且非空
- 重读 index.json，确认 `count / newCount / existingCount` 与输出一致
- 汇报表：topic | 频次 | count | new | existing | 落盘✓

任何一步数量对不上：如实报告差异，不重试掩盖。

## 相关性搜索（三层，由近及远）

回答"与 topic X 最相关的是哪些 topic"。三层独立可用，建议顺序 T1 → T2 → T3，逐层合并去重。

### T1 共现相关（本地 starred，最快最可靠）

在我的 starred 里，与 X 出现在同一仓库的 topic。已被个人收藏过滤，噪声最低：

```sql
SELECT t2.topic, count(*) n
FROM starred_repo_topics t1
JOIN starred_repo_topics t2 ON t1.repo_id = t2.repo_id AND t2.topic <> t1.topic
WHERE t1.topic = 'X'
GROUP BY t2.topic ORDER BY n DESC LIMIT 12;
```

已验证：`tailwindcss` → typescript 50 / nextjs 49 / react 45 / shadcn-ui 31。

### T2 快照重叠（已同步 topic 之间的 Jaccard）

各 topic 快照的 top-50 仓库列表求交集。**价值随同步的 topic 数量增长**——
快照少时交集稀疏是事实，如实报告，不硬凑：

```bash
bun -e '
const fs=require("fs"),path=require("path");
const dir=require("os").homedir()+"/.innate/github-topics/topics";
const files=fs.readdirSync(dir).filter(f=>f.endsWith(".json")&&!f.includes("index")&&!f.includes("user-topics"));
const sets={};
for(const f of files){const j=JSON.parse(fs.readFileSync(path.join(dir,f),"utf8"));sets[j.topic]=new Set((j.items||[]).map(i=>i.url));}
const target=process.argv[2]||"design-system";   // bun -e 不传参时改这里
const out=[];
for(const [t,s] of Object.entries(sets)){ if(t===target) continue;
  let inter=0; for(const u of sets[target]) if(s.has(u)) inter++;
  const union=new Set([...sets[target],...s]).size;
  if(inter>0) out.push([t,inter,(inter/union).toFixed(2)]);}
out.sort((a,b)=>b[1]-a[1]);
console.log("target:",target,"| repos:",sets[target].size);
for(const [t,i,j] of out.slice(0,10)) console.log(`  ${t} | 交集${i} | jaccard ${j}`);'
```

已验证：`design-system` → tailwindcss 交集 4 / shadcn-ui 交集 2（同步 25 topic 时）。

### T3 GitHub GraphQL relatedTopics（live，稀疏，尽力而为）

官方相关图，**只对部分 topic 有数据**（实测 react/vue/javascript 有值，
css/tailwindcss/machine-learning 为空）。空则静默回落 T1/T2，不要报错重试：

```bash
gh api graphql -f query='query { topic(name:"X") { relatedTopics(first:10) { name } } }' \
  --jq '[.data.topic.relatedTopics[].name] | join(", ")'
```

### 合并规则

三层结果合并 → 去重 → 标注来源层（T1/T2/T3）与分值 → 未同步的候选
直接进入工作流第 4 步同步。

## 分层精选：业务层 topic × trendshift 势头

目标：把"领域内 star 最多"（静态、老库霸榜）升级为"领域相关 × 当下势头"的
**topic 精选**。管线五步，已全链路实测（2026-11-07，设计→前端域）。

### 1. 非循环种子：关键词搜 name/description

**警告**：不能用 topic 本身定义种子再算该 topic 的 lift——seed_n==global_n，
lift 恒等于常数（循环论证，实测踩过）。种子只能来自关键词搜索：

```js
// bun + bun:sqlite，JS 正则有可靠 \b
const kw=/\b(ui|ux|design|designer|css|frontend)\b|\b设计/i;
const seeds=db.prepare("SELECT id,full_name,description FROM starred_repos WHERE stars>2000")
  .all().filter(r=>kw.test(r.full_name+" "+(r.description||"")));  // 实测 123/5066
```

### 2. lift 分层：业务层 vs 技术层

`lift(topic) = P(topic|种子) / P(topic|全库)`。两层混合判定：

- **技术层**（确定性词表，直接停用）：react, vue, angular, svelte, typescript,
  javascript, python, rust, go, css, html, tailwind*, nextjs, nodejs, vite,
  docker, kubernetes, webpack…
- **业务层**（lift 排序发现）：描述"做什么"而非"用什么做"

实测（种子 123）：claude-design 34.3 / component-library 23.5 / radix-ui 20.6 /
design-system 16.5 / ui 12.3 ← 业务层；
tailwindcss 5.3 / cursor 2.1 / skills 1.8 ← 通用层（全库到处出现）。
技术层词表 + lift 双保险：词表滤掉明确的栈词，lift 揪出残留的泛热词。

### 3. 业务层 topic 驱动同步（第 4 步 CLI，top-50/topic）

只同步业务层 topic；技术层 topic 检索出的是框架仓库，噪声大。

### 4. trendshift 交叉（势头信号）

存储：`~/.innate/trendshift/{timeframe}/{timeframe}-{lang}.json`，同步：
`bun src/app/cli.ts sync trendshift --timeframe all`（daily/weekly/monthly/yearly）。
**文件是完整归档，每期只有 top-25**——交叉必须按 `periodKey` 过滤，
否则会把历史期条目误当"当下势头"（实测踩过：全文件 Map join 取到的
rank/starsGained 来自文件里最后一次出现，可能是数月前的期）。

### 5. 精选 = 相关性 × 势头，三档口径分开报告

```
当期    periodKey == 最新一期（top-25，口径最严，命中少是正常事实）
窗口    最近 7 个 daily 期 ∪ 当前周（推荐的默认口径）
归档峰值 全档 max(starsGained)（"曾热过"信号，不是当下势头）
```

排序键：窗口内 starsGained 峰值 > rank。输出必须带出处：命中 topic +
periodKey + 该期 starsGained/rank。实测修正（设计→前端域，2026-11-07）：
当期 11-06 命中 0；窗口近 7 天命中 taste-skill（11-03，+167，#24）、
appllama-skills（11-04，+105，#17）；归档峰值另有 6 个——OpenStock 的
+1000/日发生在 09-18，shadcn-ui/lint 仅 09-15 一天，均非当期。
每期仅 25 席，单日口径命中率天然低，窗口口径才稳定。

## 领域种子词表

**设计→前端**（2026-11 从 Top 15 设计 SKILL 分析提炼，已验证产出
`tailwindcss 101 / react 88 / typescript 71 / nextjs 70 / shadcn-ui 59`）：

```
ui ux ui-design design design-system design-systems css frontend
tailwind tailwindcss shadcn shadcn-ui animation framer-motion
accessibility typography components component-library design-engineer figma
```

换领域时重写词表，其余流程不变。词表来源要可追溯：优先从该领域
种子仓库的实际 topics 里挑（第 1、2 步本身就是词表的验证器）。

## 约束

- 数据只落 `~/.innate`，不 git commit / push（仓库数据纪律）
- 网络超时属预期（参考 HuggingFace 先例）：报告为跳过，不修网络
- 同步是增量语义：已存在的仓库会标 `existing`，不会重复计数
