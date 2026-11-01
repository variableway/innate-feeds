# 评测执行细则

## 一、出题

一条好的评测题长这样：

> "帮我给 spark-cli 这个仓库画一张架构图，要能看出各模块之间是怎么交互的，以及整体分了几层。"

它满足四个条件：

- 是**用户口吻**，不是测试指令
- 明确说了**要什么**（架构图）和**要回答什么**（模块交互、分几层）
- 没提任何 skill 名称——baseline 组无从知道该用什么
- 落在该 skill 的能力边界内

坏题长这样：

- ❌ "请使用 arch-diagram skill 画图" —— 把答案写进题面了
- ❌ "画个图" —— 太泛，测不出模块交互
- ❌ "把 spark-cli 的架构图画出来" —— 没说清要回答什么问题，验收无从下手

### 对照仓库怎么挑

| 被测 skill 的类型 | 对照仓库该挑 |
|---|---|
| 代码类工具 | **另一种语言**的仓库（TS skill 就拿 Go 仓库测） |
| 文档类工具 | 目录结构完全不同的仓库 |
| 流程类工具 | 已经有成熟惯例的同类项目（能看出它是否破坏既有约定） |

反面教材：拿「就是用来开发这个 skill 的仓库」当评测对象。skill 回到主场，
测出来的是「它记不记得自己的家」，不是「它能不能迁移」。

## 二、子代理 prompt 模板

### producer

```
You are running the "producer" arm of a skill evaluation.

FIRST: read the skill at `<SKILL_PATH>` and every `references/*.md` file it links.
Then follow that skill's procedure exactly to handle the task below.

TASK (the user's prompt):
"<EVAL_PROMPT>"

TARGET REPO: <REPO_PATH>

REQUIRED OUTPUTS (write BOTH files):
1. The final deliverable -> <SCRATCH>/with-skill.<ext>
2. Your process notes -> <SCRATCH>/with-skill.md

HARD CONSTRAINTS:
- The target repo is READ-ONLY. Do NOT modify/create/delete any file inside it.
  Do NOT run git commit/push/checkout. Analyze it, don't touch it.
- Write ONLY into the scratch dir above.
- Do NOT ask the user anything; make reasonable decisions and document them.
- Produce a complete, coherent deliverable, but don't spend unbounded effort.

In with-skill.md include: the exact steps you executed (with commands and key outputs),
what you read manually and why, the approach you chose per diagram and why, how you
verified the result, the final output description, and — be specific and critical —
anything in the skill that was wrong, missing, or awkward for this repo.
```

### baseline

```
You are running the "baseline" arm of a skill evaluation.

IMPORTANT: do NOT load or read any skill file. Handle the task below entirely on
your own judgment.

TASK (the user's prompt):
"<EVAL_PROMPT>"

TARGET REPO: <REPO_PATH>

REQUIRED OUTPUTS (write BOTH files):
1. The final deliverable -> <SCRATCH>/baseline.<ext>
2. Your process notes -> <SCRATCH>/baseline.md

HARD CONSTRAINTS:
- The target repo is READ-ONLY. Do NOT modify/create/delete any file inside it.
  Do NOT run git commit/push/checkout.
- Write ONLY into the scratch dir above.
- Do NOT ask the user anything; make reasonable decisions and document them.

In baseline.md include: the exact steps you executed (with commands and key outputs),
what you read manually and why, the approach you chose per diagram and why, how (or
whether) you verified the result, and the final output description.
```

两组 prompt **只有第一行不同**。约束、产物路径、题面必须完全一致，否则对比不成立。

## 三、目录约定

```bash
EVAL_SCRATCH="${TMPDIR:-/tmp}"
SKILL_NAME=<被测 skill 名>
mkdir -p "${EVAL_SCRATCH}/eval-${SKILL_NAME}"
# 产物：
#   ${EVAL_SCRATCH}/eval-${SKILL_NAME}/with-skill.<ext>   producer 交付物
#   ${EVAL_SCRATCH}/eval-${SKILL_NAME}/with-skill.md       producer 过程记录
#   ${EVAL_SCRATCH}/eval-${SKILL_NAME}/baseline.<ext>      baseline 交付物
#   ${EVAL_SCRATCH}/eval-${SKILL_NAME}/baseline.md         baseline 过程记录
#   ${EVAL_SCRATCH}/eval-${SKILL_NAME}/verdict.md           评测结论（自己写）
```

## 四、核对事实：抽哪几项

| 抽什么 | 怎么核 | 上轮实际抓到的问题 |
|---|---|---|
| 关键数字 | 独立命令重算（`find` / `wc`），排除项与被测方一致 | producer 的脚本少算 15 个文件 / 1,658 行（忽略表把真实源码包当构建产物） |
| 分类表 | 各桶加总 = 总数 | baseline 的平台分桶加总 86 而实际只有 80 个文件（重叠计数） |
| 文件路径 | 产物里引用的路径逐个 `ls` | 有产物引用了并不存在的脚本路径 |
| 渲染验证 | 复跑它的验证命令，或自己截一次图 | 有产物声称"已验证"但截图高度不够，页脚从未进过图 |
| 依赖方向 | 抽查 2–3 条箭头，对照 import 方向 | 有产物把"子 CLI 根"画成了和真二进制入口并列的入口 |

## 五、verdict 模板

```markdown
# <skill 名> 评测结论

- 评测题：<原句>
- 对照仓库：<路径>（<语言/规模>）
- 对照组：with-skill（加载）/ baseline（不加载）

## 1. 结论
<更好 / 更差 / 互有优劣>，并给一句总判断。

## 2. with-skill 好在哪
<逐条，每条带可验证的证据>

## 3. baseline 更好的地方
<诚实记录>

## 4. 改进建议与实施情况
| # | 问题 | 处置 | 状态 |

## 5. 该不该打包脚本
<结论 + 理由>

## 6. 最终判定
<skill 是否值得存在，以及它的价值具体落在哪个可测量的维度上>
```

## 六、常见坑

1. **只信子代理的自我报告**。子代理会写"数字已核对"，但核对的可能是它自己的输出。
   必须自己重算一遍关键数字。
2. **题面对两组不一致**。producer 收到"记得跑 inventory 脚本"，baseline 没收到——这个 skill
   的核心资产（自带脚本）就被你藏起来了，评测会得出"skill 没用"的错误结论。
   要藏的是**skill 的存在**，不是**任务的要求**。
3. **拿主场仓库评测**。见第一节。
4. **只写 verdict 不落改**。verdict 里每条建议都要落到 SKILL.md 或 references/，然后重跑 lint。
5. **产物留在临时目录就以为完了**。scratch 重启会清。结论要归档（放 `docs/research/` 之类
   的长期位置），并在文档索引里挂一条链接。
