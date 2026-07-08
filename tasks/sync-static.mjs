/**
 * Standalone sync script for GitHub Pages static mode.
 * Uses gh CLI directly — no SQLite / better-sqlite3 required.
 */
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../frontend/public/data");

const today = new Date().toISOString().split("T")[0];
const fetchedAt = new Date().toISOString();

function gh(args, opts = {}) {
  return execFileSync("gh", args, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
    ...opts,
  });
}

/* ------------------------------------------------------------------ */
/* Trending                                                           */
/* ------------------------------------------------------------------ */
function fetchTrendingRepos(period) {
  let url = "https://github.com/trending";
  if (period !== "daily") url += `?since=${period}`;
  console.log(`Fetching ${period} trending from ${url}...`);

  try {
    const html = gh(["api", "-H", "Accept: text/html", url]);
    const repoRegex = /<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"]+)"[^>]*>/g;
    const repos = [];
    let match;
    while ((match = repoRegex.exec(html)) !== null) {
      const repoPath = match[1];
      if (
        repoPath &&
        repoPath.split("/").length === 2 &&
        !repoPath.startsWith("features") &&
        !repoPath.startsWith("login")
      ) {
        repos.push(repoPath);
      }
    }
    console.log(`  Found ${repos.length} trending repos`);

    const fullRepos = [];
    for (const repoFullName of repos.slice(0, 25)) {
      try {
        const repoData = gh(["api", `repos/${repoFullName}`]);
        fullRepos.push(JSON.parse(repoData));
      } catch (err) {
        console.error(`  Failed to fetch repo ${repoFullName}:`, err.message);
      }
    }
    return fullRepos;
  } catch (err) {
    console.error(`  Failed to fetch trending ${period}:`, err.message);
    return [];
  }
}

function toFeedRepo(raw) {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    description: raw.description || "",
    url: raw.html_url,
    homepage: raw.homepage,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    watchers: raw.watchers_count,
    language: raw.language,
    topics: raw.topics || [],
    owner: {
      login: raw.owner.login,
      avatarUrl: raw.owner.avatar_url,
      url: raw.owner.html_url,
    },
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function makeTrendingItems(repos, period) {
  return repos.map((repo) => ({
    id: `trending-${today}-${period}-${repo.id}`,
    type: "trending",
    snapshotDate: today,
    repo: toFeedRepo(repo),
    fetchedAt,
  }));
}

/* ------------------------------------------------------------------ */
/* Starred                                                            */
/* ------------------------------------------------------------------ */
function fetchStarredRepos() {
  const allItems = [];
  for (let page = 1; page <= 50; page++) {
    console.log(`Fetching starred page ${page}...`);
    try {
      const result = gh([
        "api",
        `user/starred?per_page=100&page=${page}&sort=created&direction=desc`,
        "--header",
        "Accept: application/vnd.github.v3.star+json",
      ]);
      const data = JSON.parse(result);
      if (!Array.isArray(data) || data.length === 0) break;

      for (const item of data) {
        allItems.push({
          id: `starred-${item.repo.id}`,
          type: "starred",
          repo: toFeedRepo(item.repo),
          fetchedAt,
          starredAt: item.starred_at,
        });
      }
      console.log(`  Got ${data.length} repos (total: ${allItems.length})`);
      if (data.length < 100) break;
    } catch (err) {
      console.error(`  Error fetching starred page ${page}:`, err.message);
      break;
    }
  }
  return allItems;
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Trending
  console.log("=== Syncing Trending ===");
  const daily = fetchTrendingRepos("daily");
  const weekly = fetchTrendingRepos("weekly");
  const monthly = fetchTrendingRepos("monthly");

  const trendingItems = [
    ...makeTrendingItems(daily, "daily"),
    ...makeTrendingItems(weekly, "weekly"),
    ...makeTrendingItems(monthly, "monthly"),
  ];

  // 2. Starred
  console.log("=== Syncing Starred ===");
  const starredItems = fetchStarredRepos();

  // 3. Languages
  const langCounts = new Map();
  for (const item of [...trendingItems, ...starredItems]) {
    const lang = item.repo.language;
    if (lang) langCounts.set(lang, (langCounts.get(lang) || 0) + 1);
  }
  const languages = Array.from(langCounts.keys()).sort();
  const topLanguages = Array.from(langCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // 4. Dates
  const dates = [today];

  // 5. Stats
  const stats = {
    totalRepos: trendingItems.length + starredItems.length,
    trendingCount: trendingItems.length,
    starredCount: starredItems.length,
    topLanguages,
  };

  // 6. Write files
  const trendingResponse = {
    items: trendingItems,
    total: trendingItems.length,
    page: 1,
    pageSize: trendingItems.length,
  };
  const starredResponse = {
    items: starredItems,
    total: starredItems.length,
    page: 1,
    pageSize: starredItems.length,
  };

  writeFileSync(
    join(OUT_DIR, "trending.json"),
    JSON.stringify(trendingResponse, null, 2),
  );
  writeFileSync(
    join(OUT_DIR, "starred.json"),
    JSON.stringify(starredResponse, null, 2),
  );
  writeFileSync(
    join(OUT_DIR, "languages.json"),
    JSON.stringify(languages, null, 2),
  );
  writeFileSync(
    join(OUT_DIR, "dates.json"),
    JSON.stringify(dates, null, 2),
  );
  writeFileSync(
    join(OUT_DIR, "stats.json"),
    JSON.stringify(stats, null, 2),
  );

  console.log("\n=== Summary ===");
  console.log(`Trending items: ${trendingItems.length}`);
  console.log(`Starred items:  ${starredItems.length}`);
  console.log(`Languages:      ${languages.length}`);
  console.log(`Output dir:     ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
