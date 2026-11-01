#!/usr/bin/env node
/**
 * inventory.js — 仓库事实清点（确定性部分）
 *
 * 给架构图提供有依据的结构数据：顶层模块划分、规模、入口候选、
 * HTTP 路由注册、模块间依赖边。
 *
 * 用法:
 *   node inventory.js <repo-root>            # JSON
 *   node inventory.js <repo-root> --summary   # 人读摘要
 *
 * 约束: 只用 Node.js 内置模块，不装任何依赖。
 * 注意: 这是省事工具，不是必经之路。脚本给不出语义——契约文件仍要手工读。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const CODE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".rb",
  ".java",
  ".kt",
  ".kts",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cs",
  ".swift",
  ".php",
  ".vue",
  ".svelte",
]);
const IGNORE_DIRS = new Set([
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".turbo",
  ".svelte-kit",
  ".next",
  ".nuxt",
  ".mypy_cache",
  ".pytest_cache",
  "vendor",
  "references",
  "reference",
  ".claude",
  ".minimax",
  // 构建产物：各生态里含义一致，直接排除
  "dist",
  "build",
  "out",
  "coverage",
]);
/**
 * 软忽略目录：只在「里面没有源码文件」时才跳过。
 * `target` 名字有歧义——Cargo 的构建输出目录叫 target，但 Go 项目的
 * internal/xxx/target/ 往往是真实源码包。硬忽略会静默少算文件（实测踩过：
 * 14 个文件 / 1565 行被漏掉），所以这一类必须按内容判断。
 */
const SOFT_IGNORE_DIRS = new Set(["target"]);
const MAX_FILES = 4000;
// 目录深度上限。太浅会静默丢文件——实测 4 层时 innate-fe 少算 86 个文件
// （packages/*/src/components/ui/ 就在第 5 层）。
const MAX_DEPTH = 12;

const args = process.argv.slice(2);
const repoRoot = path.resolve(args[0] || ".");
const summaryOnly = args.includes("--summary");
for (const a of args) {
  const m = a.match(/^--ignore-dir=(.+)$/);
  if (m)
    for (const d of m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean))
      IGNORE_DIRS.add(d);
}

/* ---------------------------------------------------------------- helpers */

/** 目录内（深度 ≤2）是否存在源码文件——用于区分「构建产物目录」与「同名源码包」。 */
function dirHasCode(dir, depth = 2) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isFile() && CODE_EXT.has(path.extname(entry.name))) return true;
    if (
      entry.isDirectory() &&
      depth > 0 &&
      !entry.name.startsWith(".") &&
      entry.name !== "node_modules"
    ) {
      if (dirHasCode(path.join(dir, entry.name), depth - 1)) return true;
    }
  }
  return false;
}

/** 该目录是否应当跳过遍历。 */
function shouldSkipDir(name, full) {
  if (name.startsWith(".")) return true;
  if (IGNORE_DIRS.has(name)) return true;
  if (SOFT_IGNORE_DIRS.has(name) && !dirHasCode(full)) return true;
  return false;
}

/** 记录被跳过的目录名——让使用者能自己判断有没有误伤（硬编码忽略表最常见的翻车点）。 */
const ignoredDirs = new Map(); // name -> {count, sample}

function noteIgnored(name, full) {
  const cur = ignoredDirs.get(name) ?? { count: 0, sample: "" };
  cur.count += 1;
  if (!cur.sample) cur.sample = path.relative(repoRoot, full);
  ignoredDirs.set(name, cur);
}

function walk(dir, depth, out, budget) {
  if (depth > MAX_DEPTH || out.length >= budget) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= budget) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name, full)) {
        noteIgnored(entry.name, full);
        continue;
      }
      walk(full, depth + 1, out, budget);
    } else if (entry.isFile()) {
      if (!CODE_EXT.has(path.extname(entry.name))) continue;
      out.push(full);
    }
  }
}

function rel(p) {
  return path.relative(repoRoot, p).split(path.sep).join("/");
}

function countLines(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    if (!text.length) return 0;
    let n = 1;
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
    return text.endsWith("\n") ? n - 1 : n;
  } catch {
    return 0;
  }
}

function readSafe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** 取顶层目录名；根目录下的散文件归为 "(root)"。 */
function topModule(file) {
  const r = rel(file);
  const parts = r.split("/");
  if (parts.length === 1) return "(root)";
  // 两层结构（如 frontend/src/...）归到第一层，但记下第二层供细分
  return parts[0];
}

function secondModule(file) {
  const r = rel(file);
  const parts = r.split("/");
  if (parts.length < 3) return null;
  return `${parts[0]}/${parts[1]}`;
}

/**
 * 依赖边用的模块粒度：两层路径。
 * monorepo 里 `packages/foo/src/x.ts` 属于 `packages/foo`，
 * `frontend/src/x.ts` 属于 `frontend/src`——比只看顶层目录精确得多。
 */
function moduleKey(file) {
  const parts = rel(file).split("/");
  return parts.length >= 3 ? `${parts[0]}/${parts[1]}` : parts[0];
}

/* ------------------------------------------------------------ route regex */

/**
 * 通用 HTTP 路由注册：`anything.get("/path")`。
 * 用「路径必须以 / 或 * 开头」过滤掉 map.get("key") 这类同名误报。
 */
const ROUTE_PATTERNS = [
  {
    re: /\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/g,
    lang: "generic",
    path: 3,
    method: (m) => m[2].toUpperCase(),
  },
  // python fastapi/flask: @app.get("/path") / @router.post(...)
  {
    re: /@\w+\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g,
    lang: "py",
    path: 2,
    method: (m) => m[1].toUpperCase(),
  },
  // python flask: app.add_url_rule("/path", ...)
  {
    re: /\badd_url_rule\s*\(\s*["'`]([^"'`]+)["'`]/g,
    lang: "py",
    path: 1,
    method: () => "ANY",
  },
  // go net/http / chi / gin / echo: mux.HandleFunc("/path", ...)
  {
    re: /\b\w+\.(HandleFunc|Handle)\s*\(\s*"([^"]+)"/g,
    lang: "go",
    path: 2,
    method: () => "ANY",
  },
  // spring: @GetMapping("/path") / @RequestMapping("/path")
  {
    re: /@(Get|Post|Put|Patch|Delete|Request)Mapping\s*\(\s*["'`]([^"'`]+)["'`]/g,
    lang: "java",
    path: 2,
    method: (m) => (m[1] === "Request" ? "ANY" : m[1].toUpperCase()),
  },
];

/** 路由挂载点：app.route("/prefix", subRouter) —— 说明子路由的 URL 前缀来自谁。 */
const MOUNT_PATTERN =
  /\b([A-Za-z_$][\w$]*)\.route\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*([A-Za-z_$][\w$]*)/g;

const ENTRY_CANDIDATES = [
  "main",
  "index",
  "app",
  "server",
  "cli",
  "__main__",
  "mod",
  "lib",
  "start",
  "bootstrap",
  "program",
  "run",
  "entry",
];

function isEntryish(file) {
  const r = rel(file);
  const base = path.basename(file, path.extname(file)).toLowerCase();
  const depth = r.split("/").length;
  // 明确入口名
  if (
    [
      "main",
      "server",
      "cli",
      "app",
      "__main__",
      "bootstrap",
      "program",
      "entry",
      "run",
    ].includes(base)
  ) {
    return true;
  }
  // index / mod 只在浅层或包根算入口，否则模块内 index.ts 会被误判
  if ((base === "index" || base === "mod") && depth <= 2) return true;
  return false;
}

/**
 * 区分入口的种类——把「唯一的真二进制入口」和「被挂载的子 CLI 根」画成并列，
 * 是架构图最容易画错的地方。
 */
function classifyEntry(text, lang) {
  if (lang === "go") {
    const isMainPkg = /^package\s+main\b/m.test(text);
    const hasMainFn = /func\s+main\s*\(/.test(text);
    if (isMainPkg && hasMainFn) return "binary";
    if (isMainPkg) return "tool";
    if (/func\s+Root\s*\(/.test(text) && /cobra\.Command/.test(text))
      return "sub-cli";
    if (/cobra\.Command/.test(text) || /urfave\/cli/.test(text)) return "cli";
    return "module";
  }
  if (/createRoot\s*\(|ReactDOM\.render\s*\(/.test(text)) return "host";
  if (/\.listen\s*\(/.test(text)) return "server";
  if (
    /program\.parse\s*\(|new\s+Command\s*\(|new\s+CommandWithSubcommands\s*\(/.test(
      text,
    )
  ) {
    return "cli";
  }
  return "entry";
}

/* --------------------------------------------------------------- imports */

/**
 * 按语言分别提取 import。行锚定的模式能大幅减少误报——
 * 通用 `from "x"` 会命中 Go 结构体标签、原始字符串里的内容。
 */
const JS_IMPORT_PATTERNS = [
  /^\s*import\s+[^;]*?\s+from\s+["']([^"']+)["']/gm,
  /^\s*export\s+[^;]*?\s+from\s+["']([^"']+)["']/gm,
  /^\s*import\s+["']([^"']+)["']/gm,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const PY_IMPORT_PATTERNS = [
  /^\s*from\s+([\w.]+)\s+import\s+/gm,
  /^\s*import\s+([\w.]+)/gm,
];

const GO_IMPORT_PATTERNS = [
  /^\s*import\s+["']([^"']+)["']/gm,
  /import\s*\(([\s\S]*?)\)/g,
];

function langOf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".go") return "go";
  if (ext === ".py") return "py";
  if (ext === ".java" || ext === ".kt" || ext === ".kts") return "java";
  return "js";
}

function extractImports(text, lang) {
  const out = [];
  const push = (v) => {
    if (v && v.trim()) out.push(v.trim());
  };
  if (lang === "go") {
    for (const re of GO_IMPORT_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m.length > 1 && m[1] && m[1].includes("\n")) {
          // import ( ... ) 块：逐个取引号里的路径
          for (const q of m[1].matchAll(/["']([^"']+)["']/g)) push(q[1]);
        } else {
          push(m[1]);
        }
      }
    }
    return out;
  }
  if (lang === "py") {
    for (const re of PY_IMPORT_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) push(m[1]);
    }
    return out;
  }
  for (const re of JS_IMPORT_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) push(m[1]);
  }
  // java/kotlin: import a.b.C;
  if (lang === "java") {
    const re = /^\s*import\s+(?:static\s+)?([\w.]+)/gm;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) push(m[1]);
  }
  return out;
}

/* ------------------------------------------------------- path resolution */

const RESOLVE_EXTS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".go",
  ".py",
  ".rb",
  ".java",
  ".kt",
  ".rs",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".php",
];

function isFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 把一个仓内绝对路径解析成真实文件。
 * 依次尝试: 原样 -> 去扩展名 -> 各扩展名变体 -> index.* ；都不中则回退为目录。
 * node_modules 一律不算仓内模块——那是外部依赖，不是本地模块。
 */
function resolveFile(abs) {
  const rootRel = path.relative(repoRoot, abs);
  if (rootRel.startsWith("..")) return null;
  if (rootRel.split(path.sep).includes("node_modules")) return null;
  const noExt = abs.replace(/\.[a-z]+$/, "");
  const candidates = [];
  for (const base of [abs, noExt]) {
    candidates.push(base);
    for (const ext of RESOLVE_EXTS) candidates.push(base + ext);
    for (const ext of RESOLVE_EXTS)
      candidates.push(path.join(base, "index" + ext));
  }
  for (const c of candidates) if (isFile(c)) return c;
  if (isDir(abs)) return abs;
  return null;
}

/* --------------------------------------------------- tsconfig path alias */

/** tsconfig 是 JSONC（允许注释与尾逗号），先剥掉再 JSON.parse。 */
function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
}

/**
 * 收集仓内 tsconfig.json 的 compilerOptions.paths 别名。
 * 别名按所在目录限定作用域（frontend/tsconfig.json 的 @/* 只对 frontend/ 生效）。
 */
function loadAliasConfigs(root) {
  const configs = [];
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    if (depth > 3) continue;
    const cfgPath = path.join(dir, "tsconfig.json");
    if (isFile(cfgPath)) {
      try {
        const json = JSON.parse(stripJsonc(fs.readFileSync(cfgPath, "utf8")));
        const co = json.compilerOptions || {};
        const baseUrl = path.resolve(dir, co.baseUrl || ".");
        const entries = Object.entries(co.paths || {}).map(([key, targets]) => {
          const star = key.indexOf("*");
          return {
            prefix: star === -1 ? key : key.slice(0, star),
            suffix: star === -1 ? "" : key.slice(star + 1),
            targets: (Array.isArray(targets) ? targets : [targets]).map((t) =>
              path.resolve(dir, t),
            ),
          };
        });
        if (entries.length) configs.push({ dir, baseUrl, entries });
      } catch {
        /* tsconfig 解析失败就跳过别名，不影响相对路径解析 */
      }
    }
    let ents = [];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of ents) {
      if (!e.isDirectory()) continue;
      if (shouldSkipDir(e.name, path.join(dir, e.name))) continue;
      stack.push({ dir: path.join(dir, e.name), depth: depth + 1 });
    }
  }
  return configs;
}

const ALIAS_CONFIGS = loadAliasConfigs(repoRoot);

/** 解析路径别名（@/foo、@scope/pkg 等），命中不了返回 null。 */
function resolveAlias(spec, fromFile) {
  const fromRel = rel(fromFile);
  for (const cfg of ALIAS_CONFIGS) {
    const scope = rel(cfg.dir);
    if (scope && !fromRel.startsWith(scope)) continue;
    for (const e of cfg.entries) {
      if (!spec.startsWith(e.prefix)) continue;
      if (e.suffix && !spec.endsWith(e.suffix)) continue;
      const mid = spec.slice(e.prefix.length, spec.length - e.suffix.length);
      for (const t of e.targets) {
        const abs = t.includes("*") ? t.replace("*", mid) : path.join(t, mid);
        const hit =
          resolveFile(abs) || resolveFile(path.resolve(cfg.baseUrl, mid));
        if (hit) return hit;
      }
    }
  }
  return null;
}

/**
 * 归一化 import specifier 到仓内模块。
 * 相对路径（"." 开头）按调用文件解析；Go 用 go.mod 的 module 前缀；
 * 其余裸包名尝试路径别名；都落空则归入外部依赖。
 */
function resolveLocal(spec, fromFile) {
  if (spec.startsWith(".")) {
    return resolveFile(path.resolve(path.dirname(fromFile), spec));
  }
  if (spec.startsWith("/")) return null;
  const goHit = resolveGoModule(spec);
  if (goHit) return goHit;
  const wsHit = resolveWorkspacePackage(spec);
  if (wsHit) return wsHit;
  return resolveAlias(spec, fromFile);
}

/** 读 go.mod 的 module 路径，用于把 Go 的模块内 import 解析成本地路径。 */
function readGoModulePath(root) {
  const p = path.join(root, "go.mod");
  if (!isFile(p)) return null;
  try {
    const m = fs.readFileSync(p, "utf8").match(/^\s*module\s+(\S+)/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const GO_MODULE = readGoModulePath(repoRoot);

function resolveGoModule(spec) {
  if (!GO_MODULE) return null;
  if (spec === GO_MODULE) return resolveFile(repoRoot);
  if (!spec.startsWith(GO_MODULE + "/")) return null;
  return resolveFile(path.join(repoRoot, spec.slice(GO_MODULE.length + 1)));
}

/**
 * 收集 workspace 内部包：package.json 的 name -> 所在目录。
 * pnpm/npm workspace 里 @scope/pkg 会被 node_modules 软链进来，
 * 不做这层映射就会把内部包误判成外部依赖。
 */
function loadWorkspacePackages(root) {
  const map = new Map();
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    if (depth > 4) continue;
    const pkgPath = path.join(dir, "package.json");
    if (isFile(pkgPath)) {
      try {
        const pkg = JSON.parse(stripJsonc(fs.readFileSync(pkgPath, "utf8")));
        if (pkg.name && !map.has(pkg.name)) map.set(pkg.name, dir);
      } catch {
        /* 解析失败忽略 */
      }
    }
    let ents = [];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of ents) {
      if (!e.isDirectory()) continue;
      if (shouldSkipDir(e.name, path.join(dir, e.name))) continue;
      stack.push({ dir: path.join(dir, e.name), depth: depth + 1 });
    }
  }
  return map;
}

const WORKSPACE_PKGS = loadWorkspacePackages(repoRoot);

function resolveWorkspacePackage(spec) {
  // 允许子路径导入：@scope/pkg/sub -> @scope/pkg
  const candidates = [spec];
  const parts = spec.split("/");
  if (spec.startsWith("@") && parts.length > 2)
    candidates.push(parts.slice(0, 2).join("/"));
  for (const c of candidates) {
    const dir = WORKSPACE_PKGS.get(c);
    if (dir) return resolveFile(dir) || dir;
  }
  return null;
}

/** 运行时内置模块：不是第三方依赖，不该出现在「外部依赖」里。 */
const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

function isRuntimeBuiltin(spec) {
  if (spec.startsWith("node:") || spec.startsWith("bun:")) return true;
  return NODE_BUILTINS.has(spec.split("/")[0]);
}

/** 裸包名 → 外部依赖包名（去掉子路径，只留包本身）。 */
function externalPackage(spec, lang) {
  if (!spec || spec.startsWith(".") || spec.startsWith("/")) return null;
  const parts = spec.split("/");
  if (spec.startsWith("@")) return parts.slice(0, 2).join("/");
  if (lang === "go") {
    // Go 标准库的 import 首段永不含点（os、path/filepath、net/http…）；
    // 外部模块路径首段必含点（github.com/...、gopkg.in/...）。
    if (!parts[0].includes(".")) return null;
    return parts.slice(0, 2).join("/");
  }
  if (isRuntimeBuiltin(spec)) return null;
  return parts[0];
}

/* ----------------------------------------------------------------- main */

const files = [];
walk(repoRoot, 0, files, MAX_FILES);
const truncated = files.length >= MAX_FILES;

const modules = new Map(); // top -> {files, lines, subs:Map}
const entries = [];
const routes = [];
const edges = new Map(); // "fromTop -> toTop" -> count
const extCounts = new Map();
const external = new Map(); // "top -> pkg" -> count
const mounts = [];
const pkgDirs = new Map(); // 直接包含源码的目录 -> {files, lines}

for (const file of files) {
  const top = topModule(file);
  if (!modules.has(top))
    modules.set(top, { files: 0, lines: 0, subs: new Map() });
  const m = modules.get(top);
  m.files += 1;
  const lines = countLines(file);
  m.lines += lines;

  const sub = secondModule(file);
  if (sub) {
    const prev = m.subs.get(sub) ?? { files: 0, lines: 0 };
    prev.files += 1;
    prev.lines += lines;
    m.subs.set(sub, prev);
  }

  const ext = path.extname(file).slice(1);
  extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);

  // 包边界：直接包含源码文件的目录。Go 里就是 package，TS 里就是子模块。
  const dir = path.dirname(rel(file));
  const pcur = pkgDirs.get(dir) ?? { files: 0, lines: 0 };
  pcur.files += 1;
  pcur.lines += lines;
  pkgDirs.set(dir, pcur);

  const text = readSafe(file);
  if (isEntryish(file)) {
    entries.push({
      file: rel(file),
      lines,
      kind: classifyEntry(text, langOf(file)),
    });
  }

  if (text.length < 400_000) {
    for (const { re, path: pIdx, method: mFn } of ROUTE_PATTERNS) {
      re.lastIndex = 0;
      let mm;
      while ((mm = re.exec(text)) !== null) {
        const r = mm[pIdx];
        if (!r || !(r.startsWith("/") || r === "*")) continue;
        routes.push({ file: rel(file), method: mFn(mm), route: r });
      }
    }
    MOUNT_PATTERN.lastIndex = 0;
    let mnt;
    while ((mnt = MOUNT_PATTERN.exec(text)) !== null) {
      mounts.push({ file: rel(file), prefix: mnt[2], sub: mnt[3] });
    }
    for (const spec of extractImports(text, langOf(file))) {
      const target = resolveLocal(spec, file);
      const key = moduleKey(file);
      if (!target) {
        const pkg = externalPackage(spec, langOf(file));
        if (pkg) {
          const ekey = `${key} → ${pkg}`;
          external.set(ekey, (external.get(ekey) ?? 0) + 1);
        }
        continue;
      }
      let targetKey;
      if (isDir(target)) {
        targetKey = path
          .relative(repoRoot, target)
          .split(path.sep)
          .slice(0, 2)
          .join("/");
      } else {
        targetKey = moduleKey(target);
      }
      if (!targetKey || targetKey === key) continue;
      const ekey = `${key} → ${targetKey}`;
      edges.set(ekey, (edges.get(ekey) ?? 0) + 1);
    }
  }
}

const moduleList = [...modules.entries()]
  .map(([name, v]) => ({
    name,
    files: v.files,
    lines: v.lines,
    subs: [...v.subs.entries()]
      .map(([s, d]) => ({ name: s, files: d.files, lines: d.lines }))
      .sort((a, b) => b.lines - a.lines),
  }))
  .sort((a, b) => b.lines - a.lines);

const routeList = [
  ...new Map(
    routes.map((r) => [r.file + "::" + r.method + " " + r.route, r]),
  ).values(),
].sort(
  (a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method),
);

const result = {
  repoRoot,
  scannedFiles: files.length,
  truncated,
  totalLines: moduleList.reduce((a, m) => a + m.lines, 0),
  languages: [...extCounts.entries()].sort((a, b) => b[1] - a[1]),
  modules: moduleList,
  entryCandidates: entries.sort((a, b) => b.lines - a.lines),
  routes: routeList,
  mounts: [
    ...new Map(
      mounts.map((m) => [m.file + "::" + m.prefix + "::" + m.sub, m]),
    ).values(),
  ],
  dependencies: [...edges.entries()]
    .map(([edge, count]) => ({ edge, count }))
    .sort((a, b) => b.count - a.count),
  externalDependencies: [...external.entries()]
    .map(([edge, count]) => ({ edge, count }))
    .sort((a, b) => b.count - a.count),
  packages: [...pkgDirs.entries()]
    .map(([name, d]) => ({ name, files: d.files, lines: d.lines }))
    .sort((a, b) => b.lines - a.lines),
  ignoredDirs: [...ignoredDirs.entries()]
    .map(([name, d]) => ({ name, count: d.count, sample: d.sample }))
    .sort((a, b) => b.count - a.count),
};

if (summaryOnly) {
  const w = (s, n) => String(s).padEnd(n);
  console.log(`仓库: ${repoRoot}`);
  console.log(
    `文件 ${result.scannedFiles} · 代码行 ${result.totalLines.toLocaleString()}${truncated ? " (已截断)" : ""}`,
  );
  console.log(
    `语言: ${result.languages
      .slice(0, 8)
      .map(([e, c]) => `${e}(${c})`)
      .join(" ")}`,
  );
  console.log(`\n== 模块 ==`);
  for (const m of moduleList) {
    console.log(
      `  ${w(m.name, 26)} ${String(m.files).padStart(4)} 文件 ${String(m.lines).padStart(7)} 行`,
    );
    for (const s of m.subs.slice(0, 10)) {
      console.log(
        `    ${w(s.name, 24)} ${String(s.files).padStart(4)} 文件 ${String(s.lines).padStart(7)} 行`,
      );
    }
  }
  console.log(`\n== 入口候选 (${result.entryCandidates.length}) ==`);
  for (const e of result.entryCandidates.slice(0, 14)) {
    console.log(`  ${w(e.file, 44)} ${w(e.kind, 9)} ${e.lines} 行`);
  }
  console.log(
    `\n== 包边界 Top ${Math.min(result.packages.length, 20)} / 共 ${result.packages.length} ==`,
  );
  for (const p of result.packages.slice(0, 20)) {
    console.log(
      `  ${w(p.name, 44)} ${String(p.files).padStart(4)} 文件 ${String(p.lines).padStart(7)} 行`,
    );
  }
  if (result.ignoredDirs.length) {
    console.log(`\n== 被忽略的目录名（确认有没有误伤）==`);
    for (const d of result.ignoredDirs) {
      console.log(
        `  ${w(d.name, 20)} ×${String(d.count).padStart(3)}  例：${d.sample}`,
      );
    }
  }
  console.log(`\n== 路由 (${result.routes.length}) ==`);
  for (const r of result.routes.slice(0, 60))
    console.log(`  ${w(r.method + " " + r.route, 46)} ${r.file}`);
  if (result.routes.length > 60)
    console.log(`  … 其余 ${result.routes.length - 60} 条见 JSON`);
  if (result.mounts.length) {
    console.log(`\n== 挂载点 (${result.mounts.length}) ==`);
    for (const m of result.mounts)
      console.log(`  ${w(m.prefix + " → " + m.sub, 46)} ${m.file}`);
  }
  console.log(`\n== 模块依赖 (${result.dependencies.length}) ==`);
  for (const d of result.dependencies.slice(0, 30))
    console.log(`  ${w(d.edge, 52)} ×${d.count}`);
  const extTop = result.externalDependencies.slice(0, 12);
  if (extTop.length) {
    console.log(
      `\n== 外部依赖 Top ${extTop.length} / 共 ${result.externalDependencies.length} ==`,
    );
    for (const d of extTop) console.log(`  ${w(d.edge, 52)} ×${d.count}`);
  }
} else {
  process.stdout.write(JSON.stringify(result, null, 2));
}
