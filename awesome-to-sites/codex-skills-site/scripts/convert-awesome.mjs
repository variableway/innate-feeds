#!/usr/bin/env node

/**
 * convert-awesome.mjs
 *
 * Converts an "awesome list" repository into a standard JSON data file.
 *
 * Usage:
 *   node scripts/convert-awesome.mjs <repo-path> [--output <output-path>] [--name <source-name>]
 *
 * Example:
 *   node scripts/convert-awesome.mjs ../awesome-codex-skills
 *   node scripts/convert-awesome.mjs ../awesome-codex-skills --output content/sources/awesome-codex-skills.json
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";

// ---------------------------------------------------------------------------
// YAML frontmatter parser (minimal, no dependency needed)
// ---------------------------------------------------------------------------

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  let currentKey = null;
  let subKey = null;

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Top-level key: value
    const topMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
    if (topMatch && !line.startsWith("  ")) {
      currentKey = topMatch[1];
      subKey = null;
      const val = topMatch[2].trim();
      if (val) result[currentKey] = val.replace(/^["']|["']$/g, "");
      continue;
    }

    // Nested key: value (2-space indent)
    const subMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
    if (subMatch && line.startsWith("  ") && currentKey) {
      subKey = subMatch[1];
      const val = subMatch[2].trim();
      if (!result[currentKey]) result[currentKey] = {};
      if (val) result[currentKey][subKey] = val.replace(/^["']|["']$/g, "");
      continue;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// README.md parser
// ---------------------------------------------------------------------------

function parseReadme(readmePath) {
  const content = readFileSync(readmePath, "utf-8");
  const lines = content.split("\n");

  const categories = [];
  const items = [];
  let currentCategory = null;
  let inSkillsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start of Skills section
    if (/^##\s+Skills/i.test(trimmed)) {
      inSkillsSection = true;
      continue;
    }

    // Detect end of Skills section (next ## heading)
    if (inSkillsSection && /^##\s+/.test(trimmed) && !/^###\s+/.test(trimmed)) {
      inSkillsSection = false;
      currentCategory = null;
      continue;
    }

    if (!inSkillsSection) continue;

    // Category heading: ### Development & Code Tools
    const catMatch = trimmed.match(/^###\s+(.+)/);
    if (catMatch) {
      const catName = catMatch[1].trim();
      const catSlug = categorySlug(catName);
      currentCategory = catSlug;
      categories.push({
        slug: catSlug,
        name: catName,
      });
      continue;
    }

    // List item: - [name](url) - description
    const itemMatch = trimmed.match(
      /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–]\s*(.+)/
    );
    if (itemMatch && currentCategory) {
      const linkText = itemMatch[1].trim();
      const url = itemMatch[2].trim();
      let description = itemMatch[3].trim();

      const isLocal = url.startsWith("./");
      const repoUrl = isLocal ? null : url;

      // Extract install command from description
      let installCommand = null;
      const installMatch = description.match(/Install:\s*`([^`]+)`/);
      if (installMatch) {
        installCommand = installMatch[1].trim();
        description = description.replace(/Install:\s*`[^`]+`/, "").trim();
      }

      // Clean description prefix like "External repo: "
      description = description.replace(/^External repo:\s*/i, "");

      // Generate slug
      const slug = isLocal
        ? slugify(linkText.replace(/\/$/, ""))
        : slugify(linkText);

      // For local skills, derive the directory path
      const localPath = isLocal ? url.replace(/^\.\//, "").replace(/\/$/, "") : null;

      items.push({
        slug,
        name: linkText.replace(/\/$/, ""),
        description,
        category: currentCategory,
        isLocal,
        repoUrl,
        installCommand,
        localPath,
        tags: [],
      });
    }
  }

  return { categories, items };
}

// ---------------------------------------------------------------------------
// SKILL.md enrichment
// ---------------------------------------------------------------------------

function enrichFromSkillMd(repoPath, items) {
  for (const item of items) {
    if (!item.isLocal || !item.localPath) continue;

    const skillMdPath = join(repoPath, item.localPath, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    const content = readFileSync(skillMdPath, "utf-8");
    const fm = parseFrontmatter(content);

    // Keep README description (curated for site display).
    // Only use SKILL.md description as fallback if README had no description.
    if (!item.description && fm.description) {
      item.description = fm.description;
    }

    if (fm.metadata?.["short-description"] && !item.shortDescription) {
      item.shortDescription = fm.metadata["short-description"];
    }

    // Use name from frontmatter if available
    if (fm.name) {
      item.name = fm.name;
    }
  }
}

// ---------------------------------------------------------------------------
// Tag generation
// ---------------------------------------------------------------------------

function generateTags(item) {
  const text = `${item.name} ${item.description}`.toLowerCase();
  const tagMap = {
    github: /\bgithub\b|\bgh\b|\bpr\b|pull request/,
    ci: /\bci\/cd\b|\bci\b|github actions|pipeline/,
    debugging: /\bdebug\b|diagnos|\btriage\b|\bsentry\b/,
    testing: /\btest\b|playwright|cypress|\be2e\b/,
    refactoring: /\brefactor\b|\bmigrat\b|\bupgrade\b/,
    deployment: /\bdeploy\b|\bvercel\b|\bnetlify\b|\bsupabase\b/,
    writing: /\bwrite\b|\bdraft\b|\bemail\b|\bchangelog\b|\bresume\b/,
    meetings: /\bmeeting\b|\btranscript\b/,
    analysis: /\banalyz\b|\bresearch\b|\binsight\b/,
    automation: /\bautomat\b|\bworkflow\b|\bcomposio\b/,
    notion: /\bnotion\b/,
    slack: /\bslack\b/,
    mcp: /\bmcp\b/,
    agents: /\bagent\b|\borchestrat\b|\bparallel\b/,
    planning: /\bplan\b|\bspec\b/,
    security: /\bsecurity\b|\bowasp\b/,
    finance: /\binvoice\b|\bfinance\b|\bbilling\b/,
    integration: /\bintegrat\b|\b1000\+\b/,
    documentation: /\bchangelog\b/,
    images: /\bimage\b|\bupscale\b|\benhance\b/,
    design: /\bdesign\b|\btheme\b|\bcanvas\b|\bbrand\b/,
    video: /\bvideo\b|\bgif\b|\banimation\b/,
    templates: /\btemplate\b|\bboilerplate\b|\bstarter\b/,
    installer: /\binstall\b/,
    sharing: /\bshare\b|\bcollaborat\b/,
    organization: /\borganiz\b|\btidy\b/,
    search: /\bsearch\b|\blookup\b/,
    news: /\bnews\b|\bbias\b|\bmarket\b/,
    formulas: /\bformula\b|\bspreadsheet\b|\bexcel\b|\bsheets\b/,
    marketing: /\bads\b|\bmarketing\b|\bcompetitor\b/,
    domains: /\bdomain\b|\bbrainstorm\b/,
    random: /\brandom\b|\braffle\b|\bwinner\b/,
    langchain: /\blangsmith\b|\blangchain\b/,
    sms: /\bsms\b/,
    verification: /\bverif\b/,
    fiction: /\bnovel\b|\bfiction\b|\bstory\b/,
    "ai-ethics": /\bethics\b|\bconsent\b|\blineage\b|\battribution\b|\bprovenance\b/,
    "ai-detection": /\bunslop\b|\bsycophancy\b/,
    career: /\bresume\b|\bjob\b/,
    frameworks: /\bframework\b/,
    governance: /\bgovern\b|\btdd\b/,
    worktree: /\bworktree\b|\bisolated\b/,
  };

  const tags = new Set();
  for (const [tag, regex] of Object.entries(tagMap)) {
    if (regex.test(text)) tags.add(tag);
  }

  // Add category as a tag too
  tags.add(item.category);

  return [...tags];
}

// ---------------------------------------------------------------------------
// Category enrichment with default colors/icons
// ---------------------------------------------------------------------------

const CATEGORY_DEFAULTS = {
  development: { icon: "code", color: "#3b82f6", description: "Development & Code Tools" },
  productivity: { icon: "briefcase", color: "#a855f7", description: "Productivity & Collaboration" },
  communication: { icon: "message-square", color: "#ec4899", description: "Communication & Writing" },
  data: { icon: "bar-chart", color: "#22c55e", description: "Data & Analysis" },
  meta: { icon: "settings", color: "#6b7280", description: "Meta & Utilities" },
  analytics: { icon: "bar-chart", color: "#f59e0b", description: "Analytics" },
  automation: { icon: "zap", color: "#f97316", description: "Automation" },
  "business-marketing": { icon: "trending-up", color: "#eab308", description: "Business & Marketing" },
  calendar: { icon: "calendar", color: "#06b6d4", description: "Calendar" },
  "creative-media": { icon: "sparkles", color: "#e879f9", description: "Creative & Media" },
  crm: { icon: "users", color: "#14b8a6", description: "CRM" },
  design: { icon: "palette", color: "#f59e0b", description: "Design" },
  devops: { icon: "terminal", color: "#6366f1", description: "DevOps" },
  ecommerce: { icon: "shopping-cart", color: "#22c55e", description: "E-Commerce" },
  email: { icon: "mail", color: "#3b82f6", description: "Email" },
  hr: { icon: "users", color: "#4f46e5", description: "HR" },
  "productivity-organization": { icon: "folder", color: "#a855f7", description: "Productivity & Organization" },
  "project-management": { icon: "kanban", color: "#0891b2", description: "Project Management" },
  "social-media": { icon: "share", color: "#e11d48", description: "Social Media" },
  spreadsheets: { icon: "table", color: "#10b981", description: "Spreadsheets" },
  "storage-docs": { icon: "hard-drive", color: "#6b7280", description: "Storage & Docs" },
  support: { icon: "headset", color: "#14b8a6", description: "Support" },
  skills: { icon: "code", color: "#10b981", description: "Skills" },
};

function enrichCategories(categories) {
  return categories.map((cat) => {
    const defaults = CATEGORY_DEFAULTS[cat.slug] || {};
    return {
      slug: cat.slug,
      name: cat.name || defaults.description || cat.slug,
      description: defaults.description || cat.name || cat.slug,
      icon: defaults.icon || "tag",
      color: defaults.color || "#6b7280",
    };
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a short category slug from a heading name.
 * "Development & Code Tools" → "development"
 * "Productivity & Collaboration" → "productivity"
 * "Data & Analysis" → "data"
 */
function categorySlug(heading) {
  const map = {
    "development & code tools": "development",
    "productivity & collaboration": "productivity",
    "communication & writing": "communication",
    "data & analysis": "data",
    "meta & utilities": "meta",
  };
  const lower = heading.toLowerCase();
  if (map[lower]) return map[lower];
  // Fallback: use first word
  return slugify(heading.split(/[\s&]+/)[0]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Usage: node scripts/convert-awesome.mjs <repo-path> [options]

Arguments:
  <repo-path>           Path to the cloned awesome list repository

Options:
  --output <path>       Output JSON file path (default: content/sources/<repo-name>.json)
  --name <name>         Source display name (default: derived from repo directory name)
  --repo-url <url>      Source repository URL
  --categories-out <p>  Categories JSON output path (default: content/categories.json)
  --merge-categories    Merge with existing categories file instead of overwriting
  -h, --help            Show this help

Examples:
  node scripts/convert-awesome.mjs ../awesome-codex-skills
  node scripts/convert-awesome.mjs ../awesome-codex-skills --repo-url https://github.com/ComposioHQ/awesome-codex-skills
`);
    process.exit(0);
  }

  const repoPath = resolve(args[0]);
  if (!existsSync(join(repoPath, "README.md"))) {
    console.error(`Error: No README.md found in ${repoPath}`);
    process.exit(1);
  }

  // Parse options
  const opts = {};
  for (let i = 1; i < args.length; i += 2) {
    opts[args[i].replace(/^--/, "")] = args[i + 1];
  }

  const repoName = basename(repoPath);
  const sourceName = opts.name || repoName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const repoUrl = opts["repo-url"] || "";
  const outputPath = opts.output || `content/sources/${repoName}.json`;
  const categoriesOut = opts["categories-out"] || "content/categories.json";
  const mergeCategories = args.includes("--merge-categories");

  console.log(`Parsing README.md from ${repoPath}...`);
  const { categories, items } = parseReadme(join(repoPath, "README.md"));

  console.log(`Found ${categories.length} categories, ${items.length} items`);

  // Enrich local skills from SKILL.md
  console.log("Enriching from SKILL.md files...");
  enrichFromSkillMd(repoPath, items);

  // Generate tags
  for (const item of items) {
    if (item.tags.length === 0) {
      item.tags = generateTags(item);
    }
  }

  // Clean up internal fields
  for (const item of items) {
    delete item.localPath;
  }

  // Build source JSON
  const sourceData = {
    source: {
      id: repoName,
      name: sourceName,
      repo: repoUrl,
      description: `Curated list from ${sourceName}`,
      addedDate: new Date().toISOString().split("T")[0],
      lastSynced: new Date().toISOString(),
    },
    items,
  };

  // Ensure output directory exists
  const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
  if (outputDir && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(sourceData, null, 2) + "\n");
  console.log(`Wrote ${items.length} items to ${outputPath}`);

  // Build/enrich categories
  const enrichedCats = enrichCategories(categories);

  let existingCategories = [];
  if (mergeCategories && existsSync(categoriesOut)) {
    try {
      const existing = JSON.parse(readFileSync(categoriesOut, "utf-8"));
      existingCategories = existing.categories || [];
    } catch {}
  }

  // Merge: keep existing, add new ones
  const catMap = new Map();
  for (const cat of existingCategories) catMap.set(cat.slug, cat);
  for (const cat of enrichedCats) {
    if (!catMap.has(cat.slug)) catMap.set(cat.slug, cat);
  }

  const categoriesData = { categories: [...catMap.values()] };
  writeFileSync(categoriesOut, JSON.stringify(categoriesData, null, 2) + "\n");
  console.log(`Wrote ${categoriesData.categories.length} categories to ${categoriesOut}`);

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Source: ${sourceName}`);
  console.log(`Categories: ${categoriesData.categories.map((c) => c.slug).join(", ")}`);
  console.log(`Items: ${items.length}`);
  const localCount = items.filter((i) => i.isLocal).length;
  const externalCount = items.filter((i) => !i.isLocal).length;
  console.log(`  Local: ${localCount}, External: ${externalCount}`);
}

main();
