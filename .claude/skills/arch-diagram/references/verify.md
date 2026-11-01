# 渲染验证：确认图真的画出来了

生成 HTML 不等于交付。**没有渲染验证过的图，等于交付了一堆空白框。**
本文件给出一套可复现的验证流程，每一步的命令都已在 macOS + Chrome 156 上实测通过。

## 为什么必须验

以下问题在 HTML 源码里**完全看不出来**：

- Mermaid 语法错误 → 整块留白，源码里只是一段正常的 `<div class="mermaid">`
- CDN 不可达 → 同上，页面结构完好，图是空的
- HTML 实体被当标签吃掉 → `~/.innate/<source>/` 渲染成 `~/.innate//`
- 截图高度不够 → 页面下半截根本没进图，误以为"那里是空的"
- 文字溢出容器 → 只有看渲染结果才发现

## 三步流程

### 第 1 步：量出页面真实高度

截图窗口比页面矮时，底部会被静默截断。先量高度：

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cp /abs/path/page.html /tmp/probe.html
# 往 </head> 前注入探针：等 Mermaid 画完再量，否则量到的是「图还没渲染」的高度
python3 - <<'EOF'
p='/tmp/probe.html'
s=open(p,encoding='utf-8').read()
inject='''<script>
window.addEventListener("load", () => {
  const t0 = Date.now();
  const tick = () => {
    const drawn = !!document.querySelector("svg[id^='mermaid-']");
    if (drawn || Date.now() - t0 > 5000) {
      document.title = "H=" + document.documentElement.scrollHeight;
    } else { setTimeout(tick, 200); }
  };
  setTimeout(tick, 300);
});
</script>'''
open(p,'w',encoding='utf-8').write(s.replace('</head>', inject+'</head>',1))
EOF
"$CHROME" --headless --disable-gpu --no-sandbox --virtual-time-budget=15000 \
  --dump-dom "file:///tmp/probe.html" 2>/dev/null | grep -o '<title>[^<]*</title>'
```

输出 `H=5876` 即页面高 5876px。用完删掉探针副本，原文件不要动。

> **为什么不能直接在 `load` 里量**：Mermaid v11 的 `startOnLoad` 自己也监听 `load`。
> 内联探针在 `<head>` 里先注册，**先于** Mermaid 渲染触发 → 量到的是「图还没画出来」的高度，
> 截图就会把渲染后的图切掉。这是时序运气，不是方法保证，所以探针必须等 SVG 出现再量。

> 经验值：`--window-size` 的高度要 **≥ 页面高度**。宁可多给 200px 留白，
> 也不要截断——底部被切掉时，截图看起来是"内容正常结束"，极易误判为通过。

### 第 1.5 步：长页面按偏移切片读

整页超过 ~3000px 时，一次性截的 PNG 读进来会被缩放到看不清，等于没验。
改成注入负 margin 分屏截，每屏偏移已知，可以逐屏读、不会漏读也不会重读：

```bash
for i in 0 1 2 3; do
  off=$((i * 1600))
  cp /abs/path/page.html /tmp/slice.html
  python3 - "$off" <<'EOF'
import sys
off = sys.argv[1]
p='/tmp/slice.html'
s=open(p,encoding='utf-8').read()
inject='<script>window.addEventListener("load",()=>{document.body.style.marginTop="-%spx";});</script>' % off
open(p,'w',encoding='utf-8').write(s.replace('</head>', inject+'</head>',1))
EOF
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=1280,1600 --virtual-time-budget=15000 \
    --screenshot=/tmp/slice-$i.png "file:///tmp/slice.html" 2>/dev/null
done
```

按顺序读完所有切片，最后一片若仍是空白，说明高度给多了，可减少屏数。


### 第 2 步：程序化确认 Mermaid 渲染成功

```bash
"$CHROME" --headless --disable-gpu --no-sandbox --virtual-time-budget=15000 \
  --dump-dom "file:///abs/path/page.html" 2>/dev/null | grep -c 'id="mermaid-'
```

- 结果 ≥ 1 → Mermaid 成功渲染，DOM 里已出现 `<svg id="mermaid-…">`
- 结果 = 0 → **图是空的**。查 CDN 可达性或 Mermaid 语法，别急着截图

这一步能在截图之前就判定失败，省一轮往返。

### 第 3 步：截图并肉眼读图

```bash
"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1280,<页面高度+200> --virtual-time-budget=15000 \
  --screenshot=/tmp/arch.png "file:///abs/path/page.html"
```

然后**用 read 工具把 PNG 当图片读进来**，逐张确认：

- [ ] 图真的画出来了（不是空白框、不是只有外框）
- [ ] 文字没有溢出容器、没有互相重叠
- [ ] 节点数量与预期一致（对照 `inventory.js` 抓到的路由数/模块数）
- [ ] 页面底部完整（页脚、最后一张图都在）
- [ ] 中文字体正常（没变成方块或豆腐）

`--virtual-time-budget=15000` 是给字体和 CDN 的加载时间；网络慢就调大。

## 常见失败模式

| 现象 | 原因 | 处理 |
|---|---|---|
| `grep -c 'id="mermaid-'` = 0 | CDN 挂了 / Mermaid 语法错 / 脚本在 `</body>` 之后没执行 | 查浏览器控制台报错；改标签文字去掉尖括号；离线环境改用本地 mermaid 文件 |
| 图渲染了但标签缺字 | Mermaid 标签里的 HTML 实体被当标签吃掉 | 标签文字去掉 `<>`，用 `{}` 或 `#quot;` |
| 截图底部空白一大段 | 窗口高度远大于页面 | 无害；高度贴近页面实际高度即可 |
| 截图底部内容被切 | 窗口高度小于页面 | 回第 1 步重新量高 |
| 中文字体变方块 | 截图机器缺中文字体 | 装字体，或页面里用 Web Font 并给足 virtual-time-budget |
| 整页只有空白 | 页面 JS 报错 | `--dump-dom` 看 DOM 是否生成；去掉 JS 依赖重试 |

## 验证不了的时候

拿不到 headless Chrome（CI 沙箱、无浏览器的远程机）时：

1. **如实说明**"图未经过渲染验证"，不要含糊过去；
2. 单独说明 Mermaid 部分的风险（最可能静默失败的就是它）；
3. 可以退一步用 `--dump-dom` 做程序化校验——它不需要看图，但能确认 SVG 是否生成。

未验证就交付，在本项目里是有代价的：上一轮交付的架构图就因为截图高度少了 276px，
页脚从未被验证过。规则很简单：**没看过渲染结果，就别说"已验证"。**
