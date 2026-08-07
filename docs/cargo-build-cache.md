# Cargo Build Cache 共享方案

> 目标：让 Rust/Tauri 的编译缓存可跨项目、跨 `cargo clean`、跨机器（团队/CI）共享，避免每次 clean 后从头编译（约 4 分钟）。

## 现状与问题

当前用 `~/.cargo/config.toml` 里的全局 `target-dir` 共享：

```toml
target-dir = "/Users/patrick/cargo-cache/cargo-target"
```

本质是把**整个 target 目录**跨所有 Rust 项目共用。硬伤：

- **`cargo clean` 是全局的** —— 在任一项目里 clean，所有项目的缓存一起清空（已踩到）。
- 跨项目依赖版本不同时 cargo 仍会重编；多项目同时构建会争用同一目录。
- 共享的是“最终产物”，不是“编译单元”，颗粒度太粗。

## 推荐方案：sccache

[sccache](https://github.com/mozilla/sccache)（Mozilla）按 `(源码哈希 + 依赖版本 + 编译器版本 + 编译 flags)` 缓存**单个 rustc 编译产物**，与 `target/` 分离存放。

优势：

- **躲过 `cargo clean`** —— sccache 缓存独立于 target 目录，clean 后重建直接命中。
- **跨项目共享** —— 同一台机器上所有 Rust 项目复用同一份依赖编译缓存。
- **对 Tauri 特别有效** —— tauri / wry / tao / webkit 等大量依赖是 lib crate，正是 sccache 能缓存的；最终二进制的 link 步骤不缓存（sccache 不缓存需要链接器的 crate），但占比小。

## 本机配置（单机）

```bash
brew install sccache
```

在 `~/.cargo/config.toml` 里加（与现有 `target-dir` 共存即可）：

```toml
[build]
rustc-wrapper = "sccache"
```

或临时用环境变量：`export RUSTC_WRAPPER=sccache`。

可选：调大缓存（默认 ~10G）：

```bash
export SCCACHE_CACHE_SIZE=20G
```

验证：构建后 `sccache --show-stats` 查看 hit rate。

**建议同时把全局 `target-dir` 去掉**，改回每项目默认 `target/`。这样 `cargo clean` 只清当前项目；跨项目的依赖复用交给 sccache（而且 sccache 不怕 clean）。这是解决“clean 一次全没”痛点的关键组合。

## 取舍：增量编译

sccache **不能缓存增量编译**的产物。Tauri 依赖编译（大头）本来就不是增量，无影响；但本项目自身 crate 的“改一行、秒编”循环，增量更快。折中策略：

- **日常**：默认开 sccache，接受失去增量（本项目自己 Rust 代码就 `src-tauri/src/lib.rs` 一个文件，影响极小）。
- **按场景区分**：CI / `tauri:build` 开 sccache（`CARGO_INCREMENTAL=0`），本地 `tauri dev` 关掉（`RUSTC_WRAPPER=`）走增量。

## 团队 / CI 扩展（远程共享）

sccache 支持远程后端：**S3 / Cloudflare R2 / redis / GCS / Azure / GitHub Actions cache / WebDAV / 阿里云 OSS / 腾讯云 COS** 等，并支持多级缓存。把所有开发机 + CI 指向同一后端，CI 编译过的 tauri 依赖，本地直接命中。

- **GitHub Actions 最省事**：用 sccache 的 **GHA cache backend**，或 `actions/cache` 缓存：
  - macOS：`~/Library/Caches/sccache`
  - Linux：`~/.cache/sccache`
- **跨机器/跨 runner 真共享**：用 S3/R2/redis 后端，配 `SCCACHE_BUCKET` / `SCCACHE_REDIS` 等环境变量。

## 补充（可选）：更快的链接器

sccache 不缓存 link 步骤，而 Tauri 最终二进制不小。可用 `mold` 或 `lld`(`ld64.lld`) 加速 link。

> ⚠️ macOS 上 link 加速增益不如 Linux 明显，且配置随 clang/LLVM 版本变化。建议按当时的工具链版本验证后再加 `rustflags = ["-C", "link-arg=-fuse-ld=..."]`，本文不固化具体配置以免过时。

## 本项目落地步骤

1. `brew install sccache` + `~/.cargo/config.toml` 加 `rustc-wrapper = "sccache"`。
2. 去掉全局 `target-dir`（改每项目 `target/`）。
3. 先跑一次 `bun run tauri:build` 填充 sccache 缓存（首次仍为冷启动，约 4 分钟）。
4. 之后任何 `cargo clean && tauri:build`，依赖部分秒级命中，整体大幅缩短。

> 注意：sidecar（`backend`，由 `bun build --compile` 产出）不是 Rust，sccache 不覆盖；其缓存由 bun 自身管理。

## Sources

- [mozilla/sccache - GitHub](https://github.com/mozilla/sccache)
