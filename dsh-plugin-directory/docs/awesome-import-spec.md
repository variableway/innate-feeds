# Awesome 导入规范（Awesome Import Spec）

> 本文档定义：任意一个 awesome 列表（如 `awesome-github`）需要转换成什么格式，才能直接被本站（dsh-plugin-directory）导入和展示；以及如何用 "AI skill 流水线"（plugin 模式）自动完成这个转换。

## 1. 站点消费的数据模型

本站的数据库核心表是 `Plugin`（见 `prisma/schema.prisma`）。每个 awesome 条目最终落到一行 `Plugin`：

| Plugin 字段 | 来源 | 必填 |
|---|---|---|
| `name` | 条目标识，惯例 `owner/repo` | ✅ |
| `slug` | 路由用，从 name/url 派生（小写、`-` 连接） | ✅（可自动生成） |
| `repositoryUrl` / `sourceUrl` | 条目 URL（upsert 幂等键） | ✅ |
| `websiteUrl` | 项目主页，缺省 = repo URL | ✅（可自动生成） |
| `tagline` / `description` | 单行描述（en） | ✅ |
| `taglineZh` | 单行中文描述 | 可选 |
| `bundleCategory` / `categoryId` | 分类 id | ✅（见 §3） |
| `stars` / `score` | GitHub star 数 | 可选（缺省 0） |
| `screenshotUrl` / `screenshots[]` | 截图 URL | 可选 |
| `publishedAt` | 收录日期 | 可选 |
| `content` | 详情页 markdown（安装命令、链接、截图） | 可自动生成 |
| `installCommand` | 安装命令（dsh 插件专用） | 可选 |
| `importSource` | 导入批次标识，如 `awesome-github-v1` | ✅ |

## 2. 交换格式：`awesome.json`（推荐）

对于"外部 awesome 仓库 → 本站"的转换，定义一个**单文件**交换格式（YAML 或 JSON 皆可，下称 `awesome.json`）。AI skill 只需要产出这一个文件。

```yaml
# awesome.json / awesome.yml 规范
source:                        # 必填，列表来源
  name: awesome-github         # 列表名（kebab-case）
  url: https://github.com/...  # 原仓库 URL
  homepage: https://...        # 可选
  license: CC0-1.0             # 可选

target:                        # 必填，导入后挂在哪
  type: category | topic       # 二选一，见 §3
  id: browser                  # type=category：必须是已有分类 id
                               # type=topic：新 topic 的 slug（kebab-case）
  label: GitHub Tools          # type=topic 时的显示名
  labelZh: GitHub 工具          # 可选

entries:                       # 必填，至少 1 条
  - name: owner/repo           # 必填
    url: https://github.com/owner/repo   # 必填，全站唯一（幂等键）
    description: One-line description.   # 必填（en）
    descriptionZh: 单行中文描述            # 可选
    stars: 123                 # 可选，缺则由 enrich 阶段补齐
    screenshots:               # 可选
      - https://raw.githubusercontent.com/...
    addedAt: "2026-08-01"      # 可选
```

### 校验规则（与 `awesome-dsh-plugin/scripts/lib/entries.mjs` 的 `validateEntries` 对齐）

1. `url` 必须匹配 `https://github.com/<owner>/<repo>[/…]`，全文件内不得重复。
2. `description` 单行、非空；`descriptionZh` 可以缺，但不能是空字符串。
3. `target.type=category` 时 `target.id` 必须在已有分类集合内；`type=topic` 时 `id` 不得与已有 topic/category 冲突。
4. `screenshots` 只允许 GitHub 系图片域名（`raw.githubusercontent.com`、`user-images.githubusercontent.com`、`camo.githubusercontent.com`、`github.com`）。

> 备注：本站当前的 `scripts/import-dsh-plugins.ts` 消费的是 awesome-dsh-plugin 的**每插件一个 YAML 文件**格式（`data/plugins/*.yml` + `stars.json`/`screenshots.json`/`added-dates.json` 三个旁挂表）。`awesome.json` 是面向任意 awesome 列表的通用入口，两者字段一一对应——单文件格式可以机械地拆成 per-plugin YAML，反之亦然。通用导入器（`scripts/import-awesome-json.ts`）按本规范实现时，只需做：解析 → 校验（上表）→ 映射到 §1 的 Plugin 字段 → 以 `sourceUrl` 为键 upsert。

## 3. Category 还是 Topic？

| 情况 | 选择 |
|---|---|
| 列表主题与现有 20 个分类之一重合（如 dsh 插件列表） | `type: category`，条目并入该分类 |
| 列表是一个独立主题（如 awesome-github、awesome-react） | `type: topic`，整体成为一个 Topic，条目保留在原列表语义下 |

- **Category** 是站点的粗粒度导航（目前 20 个，固定集合），一个条目只属于一个 category。
- **Topic** 是细粒度标签（一个 awesome 列表 = 一个 topic），一个条目可属于多个 topic；topic 维度需要扩展 schema（`Topic` 表 + `Plugin.topics` 多对多，参照 openalternative 的 `Topic` 模型）。

## 4. Plugin 模式：AI skill 转换流水线

把"awesome 仓库 → awesome.json"做成一个可复用的 AI skill（例如 `skills/awesome-import/SKILL.md`），流水线如下：

```
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────────┐   ┌─────────┐
│ 输入: 仓库URL │ → │ 1. fetch     │ → │ 2. parse      │ → │ 3. validate  │ → │ 4. emit │
│ awesome-xxx │   │ README + 元数据│   │ AI 解析条目    │   │ 按 §2 校验   │   │awesome.json│
└─────────────┘   └──────────────┘   └───────────────┘   └──────────────┘   └────┬────┘
                                                                                  │
                              ┌───────────────┐   ┌──────────────┐   ┌──────────▼────────┐
                              │ 7. 验证页面渲染 │ ← │ 6. import    │ ← │ 5. enrich（可选） │
                              │ dev server 抽查│   │ upsert 落库  │   │ 补 stars/截图     │
                              └───────────────┘   └──────────────┘   └───────────────────┘
```

各阶段职责：

1. **fetch** — `gh api repos/<owner>/<repo>/readme -H "Accept: application/vnd.github.raw"` 或 raw URL 拉取 README；同时取 repo 元数据（description、stars、topics）。
2. **parse（AI 核心步骤）** — awesome README 的条目行有强约定：`- [name](url) - description`，按 `##`/`###` 标题分组。AI skill 把每个标题映射为 category 候选，把每行解析为 `{name, url, description}`；表格、多级嵌套、description 里的链接等噪音由 AI 归一化。
3. **validate** — 按 §2 规则机器校验；不合格的条目剔除并报告（宁缺毋滥）。
4. **emit** — 产出 `awesome.json`。target 决策规则：AI 判断列表主题是否与现有 category 语义重合（重合 → category），否则生成 topic。
5. **enrich（可选）** — 批量查 GitHub API 补 `stars`；探测 README 内截图链接补 `screenshots`。
6. **import** — `bun scripts/import-awesome-json.ts awesome.json --apply`，幂等（`sourceUrl` upsert）。
7. **验证** — 启动 dev server，抽查列表页/详情页 HTTP 200 与条目数一致。

## 5. 示例：`awesome-github` 仓库的完整转换

输入：`https://github.com/awesome-github/awesome-github`（假设的 awesome 列表仓库）。

**Step 1 — fetch README：**

```bash
gh api repos/awesome-github/awesome-github/readme \
  -H "Accept: application/vnd.github.raw" > /tmp/awesome-github.md
```

**Step 2 — AI 解析。** README 片段：

```markdown
## CLI Tools
- [cli/cli](https://github.com/cli/cli) - GitHub's official command line tool.
- [hub](https://github.com/mislav/hub) - A command-line wrapper for git.

## Actions
- [actions/checkout](https://github.com/actions/checkout) - Action for checking out a repo.
```

AI skill 判断：该列表主题是 "GitHub 工具"，与现有 20 个 dsh 分类都不重合 → `type: topic`。

**Step 3/4 — 产出 `awesome.json`：**

```yaml
source:
  name: awesome-github
  url: https://github.com/awesome-github/awesome-github
target:
  type: topic
  id: github-tools
  label: GitHub Tools
  labelZh: GitHub 工具
entries:
  - name: cli/cli
    url: https://github.com/cli/cli
    description: GitHub's official command line tool.
  - name: mislav/hub
    url: https://github.com/mislav/hub
    description: A command-line wrapper for git.
  - name: actions/checkout
    url: https://github.com/actions/checkout
    description: Action for checking out a repo.
```

**Step 5 — enrich：** `gh api repos/cli/cli --jq .stargazers_count` 等批量补 `stars`。

**Step 6 — 导入：**

```bash
bun scripts/import-awesome-json.ts awesome-github.json --apply
# → upsert 3 条 Plugin，importSource = "awesome-github-v1"
# → 新建 Topic "github-tools" 并关联
```

**Step 7 — 验证：**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/topics/github-tools   # 200
curl -s http://localhost:3000/?q=cli | grep -c "cli/cli"                           # ≥1
```

## 6. 边界与注意

- **幂等**：重复跑同一个 `awesome.json` 不应产生重复行；`sourceUrl` 是唯一键。条目从原列表删除时，导入器按 `importSource` 差集标记 `status: Deleted`（不物理删除）。
- **去重**：条目可能已存在于别的 awesome 列表（别的 `importSource`）。以 `sourceUrl` 归并为同一行，追加 topic 关联而不是新建。
- **License**：awesome 列表多为 CC0，但转换产物应保留 `source.license` 署名信息。
- **不抓全文**：详情页的 `content` 默认只放描述 + 链接 + 截图；README 全文的抓取（如 awesome-dsh-plugin 的 `readmes.json`）作为可选增强，避免大列表拖慢导入。
