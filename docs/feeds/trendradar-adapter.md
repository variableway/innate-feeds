# TrendRadar Adapter

## Purpose

Reads hot-news data from TrendRadar's daily SQLite databases and presents it as feed items inside Innate Hub.

## Data Mapping

TrendRadar `news_items` → Innate Hub `items`:

| TrendRadar Field | Innate Hub Field | Notes |
|-----------------|------------------|-------|
| `title` | `title` | Direct |
| `url` / `mobile_url` | `link` | Prefers mobile_url |
| `platform_id` + `title` | `guid` | Stable composite key: `trendradar:{platform}:{title}` |
| `last_crawl_time` | `pub_date` | Best available timestamp |
| `rank`, `platform_name` | `content` | Summary line: "Rank: #N \| Platform: X" |

## Configuration

The adapter reads the directory path from:
1. Feed `link` field (if non-empty)
2. `TRENDRADAR_DATA_DIR` env var (default: `TrendRadar/output/news`)

## Behavior

- Scans `*.db` files in the data directory
- Picks the **latest** database by filename (lexicographic sort of `YYYY-MM-DD.db`)
- Opens the SQLite database read-only (WAL mode, busy timeout)
- Queries `news_items` joined with `platforms`
- Returns all rows as items

## Schema Requirements

The adapter expects TrendRadar's standard schema:
```sql
CREATE TABLE platforms (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE news_items (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    platform_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    url TEXT DEFAULT '',
    mobile_url TEXT DEFAULT '',
    first_crawl_time TEXT NOT NULL,
    last_crawl_time TEXT NOT NULL
);
```

## Auto-Creation

On startup, `cmd/hub/main.go` calls `ensureTrendRadarFeed()`:
- Checks if any feed has `source_type = 'trendradar'`
- If none exists, creates a feed named "TrendRadar Hot News" with:
  - `group_id = 1`
  - `link = {TRENDRADAR_DATA_DIR}`
  - `source_type = 'trendradar'`
