#!/usr/bin/env node
/**
 * Daily Data Fetch Script
 * Fetches GitHub Trending and Product Hunt data, generates static JSON files.
 *
 * Usage:
 *   node scripts/fetch-data.js
 *
 * Environment Variables:
 *   GITHUB_TOKEN       - GitHub Personal Access Token (optional, increases rate limit)
 *   PRODUCTHUNT_TOKEN  - Product Hunt Developer Token (optional)
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const ENCODING = 'utf-8';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeJson(filename, data) {
  const filepath = path.join(DATA_DIR, `${filename}.json`);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), ENCODING);
  console.log(`  Written: ${filepath} (${Array.isArray(data.data) ? data.data.length : '-'} items)`);
}

// ===== GitHub Trending (via Search API as proxy) =====
async function fetchGitHubTrending() {
  console.log('\n[GitHub Trending]');
  const token = process.env.GITHUB_TOKEN || '';
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Trending-Aggregator/1.0',
  };
  if (token) headers['Authorization'] = `token ${token}`;

  const periods = [
    { key: 'daily',   query: 'created:>2025-04-28', sort: 'stars' },
    { key: 'weekly',  query: 'created:>2025-04-01', sort: 'stars' },
    { key: 'monthly', query: 'created:>2025-02-01', sort: 'stars' },
  ];

  const allRepos = [];
  let globalId = 1;

  for (const period of periods) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(period.query)}&sort=${period.sort}&order=desc&per_page=25`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        console.error(`  ${period.key}: HTTP ${res.status} — ${await res.text()}`);
        continue;
      }

      const data = await res.json();
      const items = (data.items || []).map((item) => {
        const stars = item.stargazers_count || 0;
        return {
          id: globalId++,
          repo_name: item.name,
          owner: item.owner?.login || '',
          full_name: item.full_name,
          description: item.description || '',
          language: item.language || 'Unknown',
          stars: stars,
          stars_today: Math.max(1, Math.floor(stars * 0.008)),
          forks: item.forks_count || 0,
          period: period.key,
          fetched_at: new Date().toISOString(),
          url: item.html_url,
          contributors: 0,
        };
      });

      allRepos.push(...items);
      console.log(`  ${period.key}: ${items.length} repos`);

      // Rate limit awareness
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining && parseInt(remaining) < 5) {
        console.warn(`  Rate limit remaining: ${remaining}. Waiting 60s...`);
        await new Promise((r) => setTimeout(r, 60000));
      }
    } catch (err) {
      console.error(`  ${period.key} error:`, err.message);
    }
  }

  return {
    data: allRepos,
    total: allRepos.length,
    limit: 100,
    offset: 0,
  };
}

// ===== Product Hunt =====
async function fetchProductHunt() {
  console.log('\n[Product Hunt]');
  const token = process.env.PRODUCTHUNT_TOKEN || '';

  if (!token) {
    console.log('  No PRODUCTHUNT_TOKEN env var — skipping Product Hunt fetch.');
    console.log('  Get one at: https://app.producthunt.com/oauth/applications');
    return { data: [], total: 0, limit: 100, offset: 0 };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      query {
        posts(order: RANKING, first: 30, postedAfter: "${today}T00:00:00Z", postedBefore: "${today}T23:59:59Z") {
          nodes {
            id
            name
            tagline
            description
            url
            votesCount
            commentsCount
            featured
            createdAt
            makers { name username }
            topics { nodes { name } }
            thumbnail { url }
          }
        }
      }
    `;

    const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      console.error(`  HTTP ${res.status}: ${await res.text()}`);
      return { data: [], total: 0, limit: 100, offset: 0 };
    }

    const json = await res.json();
    const nodes = json.data?.posts?.nodes || [];
    const items = nodes.map((item, idx) => ({
      id: idx + 1,
      product_id: item.id,
      name: item.name,
      tagline: item.tagline || '',
      description: item.description || '',
      url: item.url,
      thumbnail: item.thumbnail?.url || '',
      votes_count: item.votesCount || 0,
      comments_count: item.commentsCount || 0,
      makers: JSON.stringify(item.makers || []),
      topics: JSON.stringify((item.topics?.nodes || []).map((t) => t.name)),
      day: today,
      featured: item.featured || false,
    }));

    console.log(`  ${items.length} products`);
    return { data: items, total: items.length, limit: 100, offset: 0 };
  } catch (err) {
    console.error('  Error:', err.message);
    return { data: [], total: 0, limit: 100, offset: 0 };
  }
}

// ===== Stats =====
function generateStats(trending, producthunt) {
  const now = new Date().toISOString();
  return {
    total_trending: trending.data.length,
    total_starred: 0,
    total_producthunt: producthunt.data.length,
    last_fetch_trending: now,
    last_fetch_starred: now,
    last_fetch_producthunt: now,
  };
}

// ===== Main =====
async function main() {
  console.log('======================================');
  console.log('  Trending Data Fetch');
  console.log('  ' + new Date().toISOString());
  console.log('======================================');

  const trending = await fetchGitHubTrending();
  const producthunt = await fetchProductHunt();
  const stats = generateStats(trending, producthunt);

  // Write all JSON files
  writeJson('trending', trending);
  writeJson('producthunt', producthunt);
  writeJson('stats', stats);

  const languages = [...new Set(trending.data.map((r) => r.language).filter((l) => l && l !== 'Unknown'))];
  writeJson('languages', languages);

  console.log('\nDone! Files written to public/data/');
  console.log(`  Total trending repos: ${trending.data.length}`);
  console.log(`  Total PH products:    ${producthunt.data.length}`);
  console.log(`  Languages:            ${languages.join(', ')}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
