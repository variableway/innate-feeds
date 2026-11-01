---
name: skill-eval
description: |
  用「有 skill / 无 skill」两组对照评测，判断一个 skill 是否真的带来提升，并给出可执行的改法。
  Use this skill when the user asks to 评测 skill / 验证 skill 效果 / skill 有没有用 /
  skill 好不好 / eval a skill / test a skill / is this skill worth keeping, or right after
  you authored or changed a skill and need evidence that it actually works.
  Do NOT use for: 创建或修改 skill 本体（用 skill-creator）、写代码时的普通 code review、
  给产品指标做数据可视化（用 visual-page）、给文档找错别字。
---

# Skill Eval

评测一个 skill 的价值。核心问题只有一个：**装了这个 skill，和没装，做同一件事，差别在哪？**

不回答这个问题的 skill 评审都是自我感觉。

## Inputs to collect

- **被测 skill 目录**：要评测的 skill 的绝对路径。
- **评测题**：一道真实用户会提出的、该 skill 应当触发的请求。
- **被测仓库**：skill 实际要干活的代码仓库。

若用户没说评测题，就自己出一道——但必须是「用户会真的这么问」的句子，不是「请展示 skill 的第 3 步」。

## Procedure

### 1. 先 lint，再评测

```bash
node <skill-creator 目录>/scripts/lint-skill.js <被测 skill 目录>
```

lint 脚本属于内置 `skill-creator`，用 `skill({ name: "skill-creator" })` 取它的 Location 路径。
**lint 不过就不要开始评测**——结构问题会让后面的对比失去意义。

### 2. 选好评测题和对照仓库

评测题决定这个 skill 会不会被触发，对照仓库决定它是不是只会写给自己看。

**对照仓库要挑结构不同的**。用一个「就是用来开发这个 skill 的仓库」当评测对象，
等于让 skill 回到主场，测不出泛化能力。判据：语言不同 / 目录布局不同 / 没有该 skill 的专用结构。

同时把评测题写成一句用户口吻的话，**不要**在题面里提示该用哪个 skill——
baseline 组必须完全不知道有这回事。

### 3. 并行跑两组

起两个 worker 子代理（并行，别串行）：

- **producer**：加载被测 skill，按它的流程做这道题
- **baseline**：不加载任何 skill，做同一道题

两组共用同一份约束：

- 目标仓库**只读**：不许改、不许 commit
- 产物只写 scratch 目录（用 `${TMPDIR:-/tmp}/eval-<skill-name>/`，别硬编码 `/tmp`）
- 不许中途问用户

prompt 模板、目录约定见 **`references/eval-protocol.md`**。

### 4. 读两份过程记录，然后**自己去核对事实**

两组都写一份过程记录（跑了哪些命令、读了哪些文件、为什么这么选渲染器、怎么验证的）。
读它们，但**不要只信它们的结论**。

**必须自己抽查关键事实**：从两份产物里各挑 2–3 个数字，用独立命令复核。

这一步不是形式。上一轮评测里，producer 跑自带脚本拿到「244 文件」，和 `find` 一对发现真值 258，
再往下查才定位到是脚本的忽略表把一个真实源码包当构建产物丢了。
**如果只读子代理的自我报告，这条 bug 会带着「已验证」的标签进入交付物。**

同理要抽查的是：

- 数字对不对（独立命令重算）
- 分类表的各桶能不能加总回总数（重叠计数会让读者无法判断有没有算漏）
- 页面里引用的文件路径真的存在吗
- 声称「已验证渲染」的，验证手段是什么

### 5. 写 verdict

五个维度，一个都不能少：

1. **with-skill 是不是真的更好**——明确结论：更好 / 更差 / 互有优劣
2. **好在哪**——具体到某个流程步骤或产出契约的差异
3. **差在哪 / 为什么**——skill 是否加了多余步骤、是否过拟合到固定格式、是否限制了判断
4. **改进建议**——3–5 条具体到 SKILL.md 或 references/ 的改法
5. **该不该打包脚本**——看 producer 过程里有没有重复的确定性动作，顺带检查 token 开销

判定要**诚实**。baseline 做得更好的地方要写出来（本轮 baseline 的完全自包含 + Playwright 断言
就比 producer 的 CDN + 截图更强），别只写自己赢的地方。

### 6. 回改，再跑一轮

把第 4 步的改进落到 skill 里，**重跑 lint**，必要时重跑 eval。

改完的每一条都要能对应到 verdict 里的某条建议，别顺手加一堆没依据的东西。

### 7. 停止条件

满足任一条即停：

- 用户满意了
- skill 明显优于或持平 baseline，且没有明显退化
- 连续两轮评测没有带来实质增益

## Windows (win32) platform notes

- scratch 目录用 `%TEMP%` 代替 `${TMPDIR:-/tmp}`：
  ```powershell
  $EVAL_SCRATCH = $env:TEMP
  New-Item -ItemType Directory -Force -Path "$EVAL_SCRATCH\eval-<skill-name>"
  ```
- lint 命令不变（`node <skill-creator>\scripts\lint-skill.js <skill 目录>`）。
- 子代理 prompt 里的路径用 Windows 反斜杠或正斜杠均可，但 `file://` 形式要写成
  `file:///C:/path/to/file`，否则渲染验证步骤打不开本地文件。

## Failure handling

- **lint 脚本找不到**：skill-creator 不可用时，手工核对 frontmatter（name 与目录同名、kebab-case、
  description 含触发短语且有 near-misses）、正文行数、references 链接是否存在。
- **两组产出差异极小**：说明评测题没打到 skill 的能力点上，换一道题，别急着下结论说 skill 没用。
- **子代理跑了很久没产出**：任务描述过宽。把范围收窄到「一张图」「一个函数」，要求聚焦。
- **baseline 明显更强**：这是好结果，照实写，并把 baseline 的优点作为 skill 的改进项。

## 与 skill-creator 的关系

`skill-creator` 负责**造** skill（起草、lint、eval、迭代的完整链路），本 skill 负责**只做评测这一段**，
且把它拆细到「怎么出题、怎么跑两组、怎么核对事实、怎么写 verdict」。

要建新 skill → 用 `skill-creator`。要验证一个已有 skill 到底有没有用 → 用本 skill。
