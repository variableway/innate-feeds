---
name: arch-diagram
description: |
  为代码仓库产出有事实依据的架构图：先清点真实模块、依赖与接口，再选渲染器生成 HTML 图页，
  最后用 headless 截图验证图确实画出来了，并落到仓库文档目录。
  Use this skill when the user asks to 画架构图 / 画一张架构图 / 项目框架图 / 模块交互图 / 代码结构图 /
  overall architecture diagram / module interaction diagram / codebase map, or asks to
  show how the modules of a repository fit together visually.
  与通用可视化页 (visual-page) 的区别：本 skill 强制先做仓库事实清点、强制渲染后验证、
  产出物落进仓库文档目录。
  Do NOT use for: 只要一段文字架构说明（不产出图）、产品指标图表与时间线（用 visual-page）、
  非代码结构的流程图/时序图（用 visual-page）、代码走查与缺陷排查（用 code-review）。
---

# Arch Diagram

给代码仓库画架构图。核心约束：**图里的每个结构、每条连线、每个数字都必须来自代码本身，而不是来自 README。**

## Inputs to collect

调用前先确认这三件事（能从上下文或仓库现状推断的就别问）：

- **目标仓库根目录**：默认当前工作区根。
- **图的落点**：默认 `<repo>/docs/arch-design/<name>.html`；先看仓库 `docs/` 现状再定，避免造出与既有约定冲突的目录。
- **受众**：给新人看（需要术语解释）还是给维护者看（直接标文件路径）。这决定标注密度。

若用户只说"画个架构图"而没给仓库，用当前工作区根，不要追问。

## Procedure

### 1. 事实清点 —— 先做这一步，别跳过

```bash
node <此 skill 目录>/scripts/inventory.js <repo-root>          # JSON
node <此 skill 目录>/scripts/inventory.js <repo-root> --summary # 人读摘要
```

脚本给出：

- **模块清单**：顶层目录 + 两层粒度的子模块，各自文件数与行数
- **包边界**：直接包含源码的每个目录（Go 里就是 package，TS 里就是子模块），含文件数与行数
- **入口候选**：按命名与深度筛出的装配入口，并**区分种类**——真二进制入口 / 被挂载的子 CLI 根 / 开发工具 / 前端宿主，不要把它们画成并列
- **HTTP 路由**：方法 + 路径 + 注册文件，以及子路由的挂载点
- **依赖边**：模块 → 模块的 import 计数（自动识别 TS 路径别名、Go module、workspace 内部包）
- **外部依赖**：模块 → 第三方包（排除 Node/Go 标准库）
- **被忽略的目录名**：脚本跳过了哪些目录——**自己确认有没有误伤**，这是最容易静默少算的地方

依赖边用**两层路径**作粒度（`frontend/src`、`packages/web-domain`），比顶层目录精确得多。

然后**手工核对关键契约文件**——脚本只能给形状，给不出语义。至少读：

- 路由/装配入口（决定"哪些模块被谁组装"）
- 插件或插件化契约（决定"模块边界画在哪"）
- 存储层入口（决定"数据从哪来、往哪去"）
- 构建/部署配置（决定"哪些文件真的进产物"）

为什么不能只看 README：README 描述的是**意图**，代码是**事实**。按文档画出来的图，画的是"项目声称自己是什么"，而不是"项目实际是什么"。实际使用时确实遇到过自述模块划分与代码依赖方向不一致的情况——这本身就是图里最值得写出来的一条。

脚本的数字要用 `find` 独立复核一遍（排除项要一致）。对不上先查脚本，别改图迁就脚本。

证据分级、统计口径写法、常见陷阱（README 与代码不符、动态注册、monorepo 跨包引用、参考仓库检出等）
见 **`references/grounding.md`**。

### 2. 分图与命题

一张图只回答一个问题。典型分法：

| 图 | 回答的问题 |
|---|---|
| 分层框架 | 这个仓库由哪几层组成，依赖方向朝哪边 |
| 模块交互 | 数据/调用在模块间怎么流动，有几条并列出口 |
| （可选）契约与清单 | 模块之间靠什么接口解耦，各自规模多大 |

2–4 张通常够用。把所有东西塞进一张图，结果是每条线都看不清。

### 3. 选渲染器

| 图的类型 | 渲染器 | 理由 |
|---|---|---|
| 分层 / 层级架构 | 手写 inline SVG | 需要精确控制位置、侧挂模块、图例；Mermaid 的 subgraph 在这种形状上会散开 |
| 模块间调用 / 数据流（≥4 节点） | Mermaid | 布局自动，连线不易交叉 |
| 2–3 节点的小流程 | CSS 卡片 + 箭头 | 为此引 Mermaid 不划算 |
| 代码量对比、模块清单 | CSS bench bar / `<table>` | 少于 5 行不引图表库 |

每张图下方写 caption，说明这张图在回答什么问题。

**先确认交付要求是否允许 CDN**：Mermaid 走 CDN 就意味着断网时整块留白。
要求离线可开 / 要归档时，全部改用手写 inline SVG。

各渲染器的可抄片段（inline SVG 分层骨架、Mermaid 初始化、CSS 时序 rail、代码量 bench bar）与
排版约定见 **`references/renderers.md`**。

### 4. 生成页面

**加载 `visual-page` skill** 取完整视觉规范（页面模式、配色、字体、CJK 密度、反 slop 清单）——本 skill 只负责"画什么、怎么保证是真的"，"画得好看"交给它，两边不要重复实现。

架构文档页的默认选择：Long-read / Report 模式（奶油底 + 衬线标题 + 单一强调色），因为读者要读文字注释，不是扫数据。

硬性要求：

- **每个数字都要有出处**：图例或 caption 写清是哪个命令统计的。
- **每张图都要有 caption**：说明它回答什么问题。
- **代码路径用等宽字体**，让读者能直接跳过去核对。

### 5. 渲染验证 —— 不能省

生成 HTML 后**必须**实际渲染一次并肉眼确认，否则交付的可能是一堆空白框。

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --no-sandbox --hide-scrollbars --window-size=1280,<页面高度+200> --virtual-time-budget=15000 \
  --screenshot=<out>.png "file://<abs-path-to-html>"
```

先用 `--dump-dom | grep -c 'id="mermaid-'` 程序化确认 Mermaid 真的渲染出了 SVG（=0 就是空的），
再用 read 工具**把截图当图片读进来**逐张确认：图真的画出来了、文字没溢出、节点数与预期一致、页面底部完整。

完整流程、测页面高度的方法、失败模式对照表见 **`references/verify.md`**。

这一步抓到的典型问题：

- Mermaid 语法错误 → 整块空白，只看 HTML 源码发现不了
- HTML 实体被吞：`&lt;source&gt;` 在 Mermaid 标签里会被当 HTML 标签吃掉，渲染成 `//`。改成不带尖括号的文字
- 截图高度不够 → 页面下半截根本没进图，误以为那里是空的

### 6. 落库与挂载

- 落到仓库既有文档目录下（先看 `docs/` 现状再定路径与命名）。
- 从仓库的**文档索引**挂一条链接——否则文件存在但没人找得到。看看 `docs/project/index.md` 或同类索引文件。
- 提交时只带文档，**不要**带上数据文件、构建产物、参考仓库检出。
- 需要公开可访问时再考虑部署；仓库内文档默认不需要。

## Output contract

- 一个自包含的 `.html` 文件（CSS/JS 内联，外部仅允许字体与图表库 CDN）。
- 一段回复说明：图有几张、每张回答什么问题、哪些结论有代码依据、哪些未验证。
- 文件用 `<deliver-assets>` 交付，路径给绝对路径。

## Failure handling

- **脚本跑不出模块划分**（非标准布局）：直接用 `find`/`wc` 手工清点，别在脚本上耗时间。脚本只是省事，不是必经之路。
- **headless Chrome 不存在**：找系统 Chrome/Chromium 的可执行文件路径换上去；都没有就明说"图未经过渲染验证"，并把 Mermaid 语法风险单独提示给用户，不要假装验证过了。
- **仓库是单文件/极小项目**：不必硬凑三层图，画一张流程图 + 一张清单即可。
- **发现仓库文档与代码严重不符**：照代码画，并在图注里点出这个差异——这本身往往是最有价值的信息。

## Windows (win32) platform notes

- 截图命令换成：
  ```powershell
  & "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" --headless --disable-gpu `
    --window-size=1280,<页面高度+200> --virtual-time-budget=15000 --screenshot="$env:TEMP\arch.png" `
    "file:///C:/path/to/page.html"
  ```
- `scripts/inventory.js` 是纯 Node.js，跨平台，无需替换。
- 手工清点命令用 PowerShell 等价写法：`Get-ChildItem -Recurse -Include *.ts,*.tsx | Measure-Object -Property Length -Sum`。
- Mermaid CDN 与 Google Fonts 在受限网络下可能不可达；此时页面结构仍可读，但 Mermaid 图会空白——按上面 Failure handling 提示用户。

## References

- **`references/grounding.md`** —— 事实清点细则：证据三级、必须人工读的契约文件、统计口径写法、常见陷阱、脚本盲区。
- **`references/renderers.md`** —— 渲染器选型与可抄片段：inline SVG 分层骨架、Mermaid 初始化与实体转义、CSS 时序 rail、代码量 bench bar、排版约定。
- **`references/verify.md`** —— 渲染验证流程：测页面高度、`--dump-dom` 程序化判定 Mermaid、截图肉眼复核清单、失败模式对照表。

## Examples

**Input**："帮我给 innate-feeds 画一张项目框架图，要能看出各模块之间怎么交互。"

**Output**：`docs/arch-design/architecture.html` —— 7 个小节：五层框架图（手写 SVG，标注真实目录与依赖方向）、模块交互图（Mermaid）、两种部署模式对照、域插件契约、模块清单（含逐模块代码量与统计口径）、一次数据更新时序、已知问题。配套 `docs/project/index.md` 挂链接。

**Input**（Go 仓库）："帮我给 spark-cli 画一张架构图，要能看出各模块之间是怎么交互的，以及整体分了几层。"

**Output**：4 层框架（命令装配 → 领域实现 → 共享契约 → 系统边界）+ witr 域交互图 + spark 工具域交互图 + 平台适配矩阵 + 29 个 Go 包的代码量清单 + 一次查询的完整路径 + 「文档与代码的差异」表。关键在于：Go 的模块边界是 **package**，平台矩阵要按「文件名后缀 ∩ `//go:build`」统计，且 `internal/witr/target` 这类目录名不能当成构建产物丢掉。

