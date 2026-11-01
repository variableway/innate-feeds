# 渲染器选型与可用片段

## 选型

| 图的类型 | 渲染器 | 为什么 | 什么时候不适用 |
|---|---|---|---|
| 分层 / 层级架构 | 手写 inline SVG | 需要精确控制位置、侧挂模块、图例、自动布局会把层级拉散 | 节点多于 ~15 个时手写坐标会失控，改用分层网格 |
| 模块间调用 / 数据流（≥4 节点） | Mermaid `flowchart` | 布局自动，连线交叉少 | 节点超过 ~15 个或需要严格分层时，Mermaid 会挤成一团 |
| 2–3 节点的小流程 | CSS 卡片 + 箭头 | 为此引图表库不划算 | — |
| 时序 / 步骤流 | CSS vertical rail（左侧竖线 + 节点） | 顺序阅读体验最好，天然支持多泳道 | 并行分支多时改用 Mermaid sequenceDiagram |
| 代码量对比、模块清单 | CSS bench bar / `<table>` | 少于 5 行不引图表库 | 需要多维对比时才引图表库 |

**判断标准**：图表库的成本是布局不可控 + CDN 可达性 + 渲染失败时整块空白。
能用 HTML+CSS 表达的，不要引库。

## 自包含 vs 依赖 CDN

Mermaid 走 CDN 意味着：**断网 / 内网 / 归档场景下整块图空白**，而且文件不再是自包含的。
选型前先确认交付要求：

| 要求 | 选择 |
|---|---|
| 允许联网、追求布局质量 | Mermaid（CDN） |
| 必须离线打开 / 要归档 / 要发给不能上网的人 | 全部手写 inline SVG，不要引 Mermaid |
| 不确定 | 手写 SVG 兜底最稳：SVG 无外部依赖，浏览器直接渲染 |

实测对比：同一份 Go CLI 架构图，纯 inline SVG 版本做到了 **0 次外部请求**（可程序化断言），
Mermaid 版本在网络受限时会静默留白。两者视觉质量差距小于「图空白」的风险差距。

如果既要 Mermaid 的布局又要自包含，把 `mermaid.esm.min.mjs` 内联进 `<script type="module">`，
或改用 `mermaid.min.js` + 相对路径——但先问自己值不值得。


## inline SVG：分层框架图

结构固定为「层容器 + 层内模块盒 + 侧挂列 + 图例」：

```html
<svg viewBox="0 0 1200 760" role="img" aria-label="分层架构图">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
    </marker>
  </defs>

  <!-- 一层 = 一个 <g>，层标题 + 层内模块盒 -->
  <g class="layer">
    <text x="24" y="40" class="layer-title">① 前端层</text>
    <rect x="16" y="56" width="820" height="120" rx="10" class="layer-box"/>
    <g class="module">
      <rect x="40" y="76" width="230" height="76" rx="8" class="module-box"/>
      <text x="56" y="104" class="module-name">routes</text>
      <text x="56" y="126" class="module-path">src/pages/</text>
    </g>
  </g>

  <!-- 依赖方向箭头：显式写，不要靠位置暗示 -->
  <path d="M200,300 L200,220" class="dep" marker-end="url(#arrow)"/>
</svg>
```

要点：

- `viewBox` 定死坐标，`width:100%` 自适应。**不要**用固定 `width`/`height` 属性，否则手机上溢出。
- 箭头方向要显式标出来，不能靠"上面比下面高"暗示。
- 侧挂模块（不属于主链路但存在的东西）单独一列，用虚线连。
- 图例放在图下方，写清实线/虚线各代表什么。
- 文字用 `class` 配 CSS，不要内联 `fill`/`font-size`——后面统一调色时只改 CSS。

## Mermaid：模块交互图

```html
<div class="mermaid">
flowchart LR
  subgraph FE["前端"]
    FE1["pages"]
    FE2["services"]
  end
  subgraph BE["后端"]
    BE1["server.ts"]
    BE2["collector"]
  end
  FE2 --&gt;|"HTTP /api/*"| BE1
  BE1 --&gt; BE2
</div>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'base', flowchart: { curve: 'basis' } });
</script>
```

**必须避开的坑**：

1. **HTML 实体被吃掉**。Mermaid 标签里的 `&lt;source&gt;` 会被当 HTML 标签解析，渲染成空的。
   → 标签文字里不要出现尖括号。`~/.innate/<source>/` 改成 `~/.innate/{source}/`。
   → 需要显示尖括号时，用 Mermaid 的 `#quot;` 实体或干脆换符号。
2. **引号冲突**。标签里有双引号会截断节点定义；用 `#quot;` 或换中文引号。
3. **子图名与节点名重名**会让布局塌掉。给 subgraph 与节点加不同前缀。
4. **CDN 不可达** → 整块空白，而且 HTML 源码看不出问题。所以必须有第 5 步的截图验证。

## CSS：时序 rail

```html
<ol class="rail">
  <li class="rail-step">
    <span class="rail-time">09:00</span>
    <div class="rail-card">
      <h4>CI 触发 <code>.github/workflows/deploy.yml</code></h4>
      <p>拉取市场目录 → 写 catalog → 导出 JSON</p>
    </div>
  </li>
</ol>
```

```css
.rail { list-style: none; margin: 0; padding: 0 0 0 28px; border-left: 2px solid var(--rule); }
.rail-step { position: relative; padding: 0 0 28px 20px; }
.rail-step::before {
  content: ""; position: absolute; left: -35px; top: 6px;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent); border: 2px solid var(--bg);
}
```

多泳道时给每个 step 加 `data-lane="ci"`，用左边框颜色区分。

## CSS：代码量 bench bar

```html
<table class="bench">
  <tr><td class="bench-label">backend</td>
      <td class="bench-track"><span class="bench-fill" style="--pct: 62"></span></td>
      <td class="bench-num">14,520 行</td></tr>
</table>
```

```css
.bench-fill { display:block; height:10px; border-radius:5px;
              width: calc(var(--pct) * 1%); background: var(--accent); }
```

> **用 `<span>` 实现时必须保留 `display:block`。** inline 元素会忽略 `width`，
> 结果是 10 条 bar 全渲染成空轨道——HTML 源码完全看不出问题，只有截图能发现。

百分比要**按最大值归一化**，不是按总量——否则最小的模块会短到看不见。
每行旁边标绝对值，读者既能比大小也能看总量。

## 排版

- 代码路径、命令、文件名一律 `<code>` + 等宽字体，读者要能直接跳过去核对。
- CJK 正文行高 1.8；数字与英文用 tabular-nums。
- 图注（caption）写"这张图回答什么问题"，而不是"这是 XX 图"。
- 每张图下方标统计口径（见 `grounding.md`）。
