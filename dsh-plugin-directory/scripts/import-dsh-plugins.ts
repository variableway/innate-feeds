#!/usr/bin/env bun
/**
 * Import awesome-dsh-plugin data into the Plugin table.
 *
 * Sources (all inside the awesome-dsh-plugin repo):
 *   data/plugins/*.yml     — the entries (url, name, category, description.{en,zh}, tarball?, npm?)
 *   data/stars.json        — { <url>: { stars, checkedAt } }
 *   data/screenshots.json  — { <url>: [imageUrl, ...] }
 *   data/added-dates.json  — { <url>: "YYYY-MM-DD" | ISO }
 *
 * Usage:
 *   bun scripts/import-dsh-plugins.ts                          # dry-run (default, no DB)
 *   bun scripts/import-dsh-plugins.ts --apply                  # write to DB
 *   bun scripts/import-dsh-plugins.ts --dry-run --limit 10     # smoke test
 *   bun scripts/import-dsh-plugins.ts --data-dir ../awesome/awesome-dsh-plugin/data
 *
 * Idempotent: upsert keyed on sourceUrl.
 */
import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { load as yamlLoad } from "js-yaml"

import { CATEGORIES, CATEGORY_IDS, categoryById, type CategoryId } from "../src/lib/categories"

// ─── Types ───────────────────────────────────────────────────────────────────
interface DshEntry {
  url: string
  name?: string
  category?: string
  description?: { en?: string; zh?: string }
  tarball?: string
  npm?: string
  file: string
}

interface PluginPayload {
  name: string
  slug: string
  websiteUrl: string
  repositoryUrl: string
  tagline: string
  taglineZh: string | null
  description: string
  content: string
  stars: number
  score: number
  screenshotUrl: string | null
  screenshots: string[]
  bundleCategory: CategoryId
  bundleCategoryZh: string
  sourceUrl: string
  sourceRepo: string
  yamlFile: string
  importSource: "awesome-dsh-plugin-v1"
  npmPackage: string | null
  tarballUrl: string | null
  installCommand: string
  status: "Published"
  publishedAt: Date | null
  categoryId: CategoryId
}

interface PlanOp {
  action: "insert" | "skip"
  file: string
  reason?: string
  payload?: PluginPayload
}

interface Stats {
  filesScanned: number
  yamlsValid: number
  yamlsSkipped: number
  byCategory: Record<string, number>
  slugCollisions: string[]
  urlCollisions: string[]
  descZhMissing: number
  starsJoined: number
  screenshotsJoined: number
  datesJoined: number
}

// ─── Companion data ──────────────────────────────────────────────────────────
type StarsMap = Record<string, { stars: number; checkedAt?: string }>
type ScreenshotsMap = Record<string, string[]>
type DatesMap = Record<string, string>

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T
  } catch {
    console.warn(`  warn: ${path} not readable, continuing without it`)
    return {} as T
  }
}

// ─── Slug & URL parsing ──────────────────────────────────────────────────────
function parseUrl(url: string): { owner: string; repo: string; sub: string | null } {
  const p = url.replace(/^https:\/\/github\.com\//, "").replace(/\/+$/, "")
  const [owner, repo, ...rest] = p.split("/")
  // ".../tree/main/packages/x" → sub = "packages/x"
  const sub = rest[0] === "tree" ? rest.slice(2).join("/") || null : rest.join("/") || null
  return { owner: owner ?? "", repo: repo ?? "", sub }
}

/** slug comes from the YAML filename (awesome-dsh-plugin convention:
 *  <owner>__<repo>[--packages-<sub>]) so monorepo sub-packages stay distinct. */
function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.yml$/, "")
    .toLowerCase()
    .replace(/__/g, "-")
    .replace(/--/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

// ─── Content markdown ────────────────────────────────────────────────────────
function buildContent(e: DshEntry, installCommand: string, screenshots: string[]): string {
  const lines: string[] = []
  lines.push("## Install", "", "```sh", installCommand, "```", "")
  if (e.npm) lines.push(`Also available as the npm package [\`${e.npm}\`](https://www.npmjs.com/package/${e.npm}).`, "")
  if (e.tarball) lines.push(`Prebuilt release tarball: [download](${e.tarball}).`, "")
  lines.push(`Source: [${e.url}](${e.url})`, "")
  if (screenshots.length > 0) {
    lines.push("## Screenshots", "")
    for (const s of screenshots) lines.push(`![screenshot](${s})`, "")
  }
  lines.push(
    "---",
    "",
    "> Installing a plugin runs third-party code with your own permissions. Review the source before you install.",
  )
  return lines.join("\n")
}

// ─── Read & validate (DB-independent) ────────────────────────────────────────
async function readYamls(dir: string): Promise<{ entries: DshEntry[]; parseErrors: string[] }> {
  const parseErrors: string[] = []
  const entries: DshEntry[] = []
  let names: string[]
  try {
    names = (await readdir(dir)).filter((f) => f.endsWith(".yml")).sort()
  } catch (e) {
    return { entries, parseErrors: [`cannot read ${dir}: ${(e as Error).message}`] }
  }
  for (const f of names) {
    const full = join(dir, f)
    try {
      entries.push({ ...(yamlLoad(await readFile(full, "utf8")) as object), file: full } as DshEntry)
    } catch (e) {
      parseErrors.push(`${full}: ${(e as Error).message}`)
    }
  }
  return { entries, parseErrors }
}

function validateAndProject(
  entries: DshEntry[],
  stars: StarsMap,
  screenshotsMap: ScreenshotsMap,
  dates: DatesMap,
): { ops: PlanOp[]; problems: string[]; stats: Stats } {
  const problems: string[] = []
  const ops: PlanOp[] = []
  const seenUrl = new Map<string, string>()
  const slugCount = new Map<string, number>()
  const stats: Stats = {
    filesScanned: entries.length,
    yamlsValid: 0,
    yamlsSkipped: 0,
    byCategory: Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])),
    slugCollisions: [],
    urlCollisions: [],
    descZhMissing: 0,
    starsJoined: 0,
    screenshotsJoined: 0,
    datesJoined: 0,
  }

  for (const e of entries) {
    const skip = (reason: string, problem?: string) => {
      if (problem) problems.push(problem)
      ops.push({ action: "skip", file: e.file, reason })
      stats.yamlsSkipped++
    }

    if (typeof e.url !== "string" || !/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(e.url)) {
      skip("url invalid", `${e.file}: url 不合法（需 https://github.com/<owner>/<repo>）`)
      continue
    }
    if (seenUrl.has(e.url)) {
      skip("duplicate url", `${e.file}: 与 ${seenUrl.get(e.url)} 重复 url（${e.url}）`)
      stats.urlCollisions.push(`${e.file} ≡ ${seenUrl.get(e.url)}`)
      continue
    }
    seenUrl.set(e.url, e.file)

    if (typeof e.name !== "string" || !e.name.trim()) {
      skip("missing name", `${e.file}: 缺 name`)
      continue
    }
    if (!CATEGORY_IDS.includes(e.category as CategoryId)) {
      skip(`bad category: ${e.category}`, `${e.file}: category=${JSON.stringify(e.category)} 不在合法值内`)
      continue
    }
    const descEn = e.description?.en
    if (typeof descEn !== "string" || !descEn.trim()) {
      skip("missing description.en", `${e.file}: 缺 description.en`)
      continue
    }

    const { owner, repo, sub } = parseUrl(e.url)
    const filename = e.file.split("/").pop()!
    const slug = slugFromFilename(filename)
    slugCount.set(slug, (slugCount.get(slug) ?? 0) + 1)

    const descZh = e.description?.zh
    if (descZh === undefined) stats.descZhMissing++

    const cat = e.category as CategoryId
    const installCommand = `dsh plugin --profile web add github:${owner}/${repo}${sub ? `#path:/${sub}` : ""}`

    // joins
    const starCount = stars[e.url]?.stars ?? (stars[`https://github.com/${owner}/${repo}`]?.stars ?? 0)
    if (starCount > 0) stats.starsJoined++
    const shots = screenshotsMap[e.url] ?? screenshotsMap[`https://github.com/${owner}/${repo}`] ?? []
    if (shots.length > 0) stats.screenshotsJoined++
    const added = dates[e.url] ?? dates[`https://github.com/${owner}/${repo}`]
    const publishedAt = added ? new Date(added) : null
    if (publishedAt && !Number.isNaN(publishedAt.getTime())) stats.datesJoined++

    ops.push({
      action: "insert",
      file: e.file,
      payload: {
        name: e.name,
        slug,
        websiteUrl: `https://github.com/${owner}/${repo}`,
        repositoryUrl: e.url,
        tagline: descEn,
        taglineZh: typeof descZh === "string" && descZh.trim() ? descZh : null,
        description: descEn,
        content: buildContent(e, installCommand, shots),
        stars: starCount,
        score: starCount,
        screenshotUrl: shots[0] ?? null,
        screenshots: shots.slice(1),
        bundleCategory: cat,
        bundleCategoryZh: categoryById(cat)!.labelZh,
        sourceUrl: e.url,
        sourceRepo: `${owner}/${repo}`,
        yamlFile: `data/plugins/${filename}`,
        importSource: "awesome-dsh-plugin-v1",
        npmPackage: e.npm ?? null,
        tarballUrl: e.tarball ?? null,
        installCommand,
        status: "Published",
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
        categoryId: cat,
      },
    })
    stats.yamlsValid++
    stats.byCategory[cat] = (stats.byCategory[cat] ?? 0) + 1
  }

  for (const [slug, n] of slugCount) if (n > 1) stats.slugCollisions.push(`${slug} ×${n}`)
  return { ops, problems, stats }
}

// ─── Report ──────────────────────────────────────────────────────────────────
function printReport(
  ops: PlanOp[],
  problems: string[],
  stats: Stats,
  opts: { limit?: number; apply: boolean },
) {
  const inserts = ops.filter((o) => o.action === "insert")
  console.log("\n──── awesome-dsh-plugin → Plugin 表 导入计划 ────")
  console.log(`模式:               ${opts.apply ? "APPLY（将落库）" : "DRY-RUN（仅打印）"}`)
  console.log(`扫描 YAML:          ${stats.filesScanned}`)
  console.log(`可插入:             ${stats.yamlsValid}`)
  console.log(`跳过:               ${stats.yamlsSkipped}`)
  console.log(`url 冲突:           ${stats.urlCollisions.length}（应=0）`)
  console.log(`slug 冲突:          ${stats.slugCollisions.length}`)
  console.log(`缺 zh 描述:         ${stats.descZhMissing}`)
  console.log(`stars 命中:         ${stats.starsJoined}`)
  console.log(`screenshots 命中:   ${stats.screenshotsJoined}`)
  console.log(`added-date 命中:    ${stats.datesJoined}`)

  console.log("\n── 按 category 分布 ──")
  for (const c of CATEGORIES) {
    const n = stats.byCategory[c.id] ?? 0
    if (n > 0) console.log(`  ${c.emoji}  ${c.id.padEnd(10)} ${String(n).padStart(4)}  ${c.label} / ${c.labelZh}`)
  }

  if (problems.length) {
    console.log(`\n── ⚠ ${problems.length} 个问题（前 20 条）──`)
    problems.slice(0, 20).forEach((p) => console.log(`  ${p}`))
    if (problems.length > 20) console.log(`  ... 还有 ${problems.length - 20} 条`)
  }

  const sampleN = opts.limit ?? 3
  console.log(`\n── 计划插入示例（前 ${sampleN} 条）──`)
  for (const op of inserts.slice(0, sampleN)) {
    const p = op.payload!
    console.log(`  ${p.slug}  ★${p.stars}  [${p.bundleCategory}]`)
    console.log(`    install: ${p.installCommand}`)
  }

  if (!opts.apply) console.log(`\n✓ DRY-RUN 完成。要真插入：bun scripts/import-dsh-plugins.ts --apply`)
  console.log("──────────────────────────────────────\n")
}

// ─── Apply ───────────────────────────────────────────────────────────────────
async function applyPlan(ops: PlanOp[]) {
  const { db } = await import("../src/lib/db")
  const inserts = ops.filter((o) => o.action === "insert") as Array<PlanOp & { payload: PluginPayload }>

  // Seed the 20 categories first
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { id: c.id },
      create: { id: c.id, label: c.label, labelZh: c.labelZh, emoji: c.emoji },
      update: { label: c.label, labelZh: c.labelZh, emoji: c.emoji },
    })
  }
  console.log(`categories upserted: ${CATEGORIES.length}`)

  console.log(`开始 upsert ${inserts.length} 条...`)
  const BATCH = 25
  let done = 0
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH)
    await db.$transaction(
      batch.map((op) =>
        db.plugin.upsert({
          where: { sourceUrl: op.payload.sourceUrl },
          create: op.payload,
          update: {
            name: op.payload.name,
            tagline: op.payload.tagline,
            taglineZh: op.payload.taglineZh,
            description: op.payload.description,
            content: op.payload.content,
            stars: op.payload.stars,
            score: op.payload.score,
            screenshotUrl: op.payload.screenshotUrl,
            screenshots: op.payload.screenshots,
            bundleCategory: op.payload.bundleCategory,
            bundleCategoryZh: op.payload.bundleCategoryZh,
            sourceRepo: op.payload.sourceRepo,
            yamlFile: op.payload.yamlFile,
            importSource: op.payload.importSource,
            npmPackage: op.payload.npmPackage,
            tarballUrl: op.payload.tarballUrl,
            installCommand: op.payload.installCommand,
            publishedAt: op.payload.publishedAt,
            categoryId: op.payload.categoryId,
          },
        }),
      ),
      { timeout: 60_000 },
    )
    done += batch.length
    console.log(`  ${done}/${inserts.length}`)
  }
  console.log("✓ 完成。")
  await db.$disconnect()
}

// ─── Entry ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const limitIdx = args.indexOf("--limit")
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined
  const dataDirIdx = args.indexOf("--data-dir")
  const dataDir = dataDirIdx >= 0
    ? resolve(args[dataDirIdx + 1]!)
    : resolve(dirname(fileURLToPath(import.meta.url)), "../../awesome/awesome-dsh-plugin/data")
  const yamlDir = join(dataDir, "plugins")

  console.log(`数据目录: ${dataDir}`)
  const { entries, parseErrors } = await readYamls(yamlDir)
  const [stars, screenshots, dates] = await Promise.all([
    readJson<StarsMap>(join(dataDir, "stars.json")),
    readJson<ScreenshotsMap>(join(dataDir, "screenshots.json")),
    readJson<DatesMap>(join(dataDir, "added-dates.json")),
  ])
  if (parseErrors.length) {
    console.error("YAML 解析错误:")
    parseErrors.forEach((e) => console.error(`  ${e}`))
  }

  const { ops, problems, stats } = validateAndProject(entries, stars, screenshots, dates)
  const finalOps = limit ? ops.slice(0, limit) : ops
  printReport(finalOps, problems, stats, { limit, apply })

  if (apply) {
    if (problems.length > 0 && !args.includes("--force")) {
      console.error(`发现 ${problems.length} 个问题，跳过 --apply。加 --force 强制执行。`)
      process.exit(1)
    }
    await applyPlan(finalOps)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
