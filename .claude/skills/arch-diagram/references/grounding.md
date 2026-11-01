# 事实清点：让图里的每个结构都来自代码

架构图最容易出的错不是画得丑，而是**画的是"项目声称自己是什么"，不是"项目实际是什么"**。
本文件规定怎么把图的每个断言锚定到代码。

## 证据分三级

| 级别 | 来源 | 允许的措辞 |
|---|---|---|
| A 统计 | 脚本跑出来的数字（文件数、行数、路由数、依赖边） | "N 个文件 / M 行（统计口径见下）" |
| B 代码 | 人工读过的契约文件、入口文件 | "X 由 Y 装配" / "依赖方向是 A → B" |
| C 未验证 | 只能从 README、注释、命名推测 | 标"未验证"或干脆不画 |

**C 级内容不许进图**，除非图注明确标注了它是推测。
A 级和 B 级都要能给出复现命令或文件路径。

## 必须人工读的文件类型

脚本只能给形状，语义必须自己读。至少覆盖这几类：

1. **装配入口** —— 谁把谁装起来。决定"模块边界画在哪"。
   典型：`main.ts` / `server.ts` / `app.ts` / `plugin.json` / `workspace` 配置。
2. **扩展点契约** —— 模块之间靠什么接口解耦。决定"箭头是实线还是虚线"。
   典型：`createWebDomain()` / `Plugin` 接口 / `register()` 协议 / `defineConfig`。
3. **数据出入口** —— 数据从哪来、往哪去。决定"数据流箭头指向"。
   典型：DB 初始化、store 模块、HTTP client、CLI 的 command 注册。
4. **构建与部署配置** —— 决定"哪些文件真的会被打进产物"。
   典型：`package.json` 的 `main`/`exports`/`files`、CI workflow、build script。

> 判据：如果一条箭头出现在图上，就必须能在某个文件里指出"这一行让它成立"。

## 统计口径必须写出来

数字脱离了口径就是噪音。页脚或 caption 里至少写清：

- **行数口径**：哪些扩展名计入？是否排除测试文件、生成代码、锁文件？
  例：`ts + tsx，排除 *.test.ts`。
- **文件数口径**：是否排除 `node_modules` / `dist` / `vendor` / 参考仓库检出？
- **时间点**：快照时间。架构文档会过期，写上"统计于 YYYY-MM-DD，commit abc1234"。

一条事实的合格写法：

> backend 62 个 TS 文件 / 14,520 行（统计口径：`ts`+`tsx`，排除 `*.test.ts`；
> 命令 `node scripts/inventory.js . --summary`，统计于 2026-11-01，commit 88613e2）

## 非 JS 仓库的等价物

skill 的例子都以 TS/JS 为准。换语言时按下表换算，否则会漏掉关键结构：

| 概念 | TS/JS | Go | Python | Rust |
|---|---|---|---|---|
| 模块边界 | `package.json` / tsconfig `paths` | **一个 package = 一个目录**（`internal/witr/proc` 就是一个包） | 一个含 `__init__.py` 的目录 | 一个 crate = `Cargo.toml` |
| 公共 API 面 | `exports` 字段 | **`pkg/` 目录**（Go 惯例：可被外部 import） | 顶层包 | `lib.rs` 的 `pub` |
| 依赖清单 | `package.json` / `pnpm-lock` | `go.mod` | `pyproject.toml` | `Cargo.toml` |
| 构建入口 | `scripts/build.ts` | `Makefile` / `Taskfile.yml` | `pyproject` scripts | `Cargo.toml` |
| 平台/条件编译 | tsconfig `env` | **`//go:build` 标签 + 文件名词缀** | 无 | `#[cfg(target_os)]` |

**Go 的平台矩阵是「文件名后缀 ∩ build tag」，不是并集。**
`target/file_darwin.go` 这种文件靠 Go 的文件名后缀约定生效，可能**完全没有** `//go:build` 行；
只按 tag 统计或只按后缀统计，都会得出不同且都不对的数字。
把「仅后缀」「仅 tag」「两者都有」三类分开统计，才对得上总数。

## 分类表必须能加总

图里凡是把文件分成几类的表（按平台、按层、按有无测试），**各类必须互斥，且各桶之和 = 总数**。

这是实际评测里踩到的差异点。同一份 `internal/witr/proc`（80 个 Go 文件）：

- ❌ 按「标签里提到该 OS」分桶：linux 22 / darwin 22 / freebsd 18 / windows 24 → 加总 86 > 80，
  多 OS 文件被重复计数，读者无法判断有没有算漏。
- ✅ 按互斥归类分桶：darwin 专属 14 / linux 专属 16 / windows 专属 17 / freebsd 专属 14 /
  全平台通用 14 / 跨平台子集 5 → 加总**恰好 80**。

多 OS 标签（`linux || darwin`）要单独设「跨平台子集」桶，否则必然对不上总数。
写完表后加一道自检：把各桶加起来，和总数比一次。

## 口径要贴在数字旁边

数字旁边的口径说明比页脚的口径更有效。SVG 图层标签里写「139 文件 / 15,927 行」时，
必须同处说明**排除了什么**（例如「不含 launchd / version / docgen」），
否则读者按全仓口径一算就对不上，会怀疑整张图。


## 常见陷阱

- **README 与代码不符**：以代码为准，并在图注里点出差异——这往往是最有价值的信息。
- **注释掉的代码**：不看注释，只看实际生效的引用。
- **动态注册**：路由用变量拼出来、装饰器注册、反射加载——正则抓不到，必须读装配文件。
- **monorepo 跨包引用**：包 A 的代码 import 包 B 的源码，运行时边界 ≠ 目录边界。按实际依赖画，别按目录想当然。
- **构建产物**：别把 `dist/`、`vendor/`、生成代码算进模块规模。
- **参考仓库检出**：本机常有大体积的 `references/`、`vendor/` 副本，必须排除，否则模块划分全错。
- **测试文件**：单独统计或直接排除，不要混进主体规模——两者差一个数量级。

## 交叉验证

跑完脚本后，用一条**独立**命令复核最关键的那个数字：

```bash
find . \( -name "*.ts" -o -name "*.tsx" -o -name "*.mjs" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "./references/*" \
  | wc -l
```

两个数字对不上，先查脚本，再改图——**不要改图去迁就脚本**。

实测踩过的坑（脚本的已知弱项，交叉验证能抓到）：

- **目录名撞车**：`target` 在 Rust 项目里是构建输出，在 Go 项目里可能是真实源码包。
  硬忽略会静默少算（实测漏掉 14 个文件 / 1565 行）。
- **遍历深度**：目录层级限制太浅会漏掉深层包（实测 4 层时少算 86 个文件）。
- **本地 clone 的参考仓库**：`references/`、`reference/` 里可能躺着几十 MB 的源码，
  不排除会把整个模块划分算错。

复核命令的排除项要和脚本一致，否则会比出假差异。

## 已知脚本盲区

`scripts/inventory.js` 是启发式的，这些它抓不到，需要人工补：

- 运行期动态注册（字符串拼出来的路由、插件 manifest 驱动的加载）
- 构建期生成的文件（protobuf、ORM 模型、模板产物）
- 跨进程/跨语言调用（HTTP、消息队列、CLI 子进程）
- 配置文件驱动的依赖关系（Dockerfile、CI 矩阵、k8s manifest）

它**已经**处理的（不用重复手算）：TS `paths` 别名（`@/*`）、Go `go.mod` module 路径、
pnpm/npm workspace 内部包（`@scope/pkg` → `packages/pkg`）、Node/Go 标准库排除、
依赖边的两层模块粒度（`frontend/src`、`packages/web-domain`）。

依赖边是**按 import 语句计数**的，不是运行时调用次数。箭头方向 = import 方向。

