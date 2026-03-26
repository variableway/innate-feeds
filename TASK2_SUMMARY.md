# Task 2 Implementation Summary - GitHub Trending

## ✅ Completed Requirements

### 1. Daily Gather GitHub Trending Repo (Daily/Weekly/Monthly) ✅
- Implemented HTML scraper for GitHub trending page
- Supports three periods: daily, weekly, monthly
- Parses repository details including:
  - Repository name and full name
  - Description
  - Stars and forks
  - Stars gained today
  - Language
  - Topics/tags
  - Ranking position

### 2. Save Repo Info with Snapshot Date ✅
- New `trending_repos` collection (separate from starred repos)
- All Task 1 attributes maintained:
  - star_num
  - repo_name
  - description
  - language
  - fork_num
  - tags
- Additional fields:
  - `snapshot_date` - Date when trending data was collected
  - `trending_period` - daily/weekly/monthly
  - `stars_today` - Stars gained in the period
  - `rank` - Position in trending list

### 3. Separate Table from Task 1 ✅
- `starred_repos` - For user's starred repositories
- `trending_repos` - For trending repositories with snapshots
- Both tables share similar structure but serve different purposes

### 4. Page to Show List for Different Dates ✅
- New page: `/trending`
- Features:
  - Period selector (Daily/Weekly/Monthly)
  - Date picker showing all available snapshot dates
  - Language filter
  - Ranked display (#1, #2, etc.)
  - Stars gained indicator
  - Responsive grid layout

### 5. Daily Running Job ✅
- Built-in cron scheduler runs at 1 AM UTC daily
- Collects all three periods automatically
- GitHub Actions workflow updated to collect trending data
- Manual collection via API endpoint

## 📁 New Files Added

```
github-collectors/
├── backend/
│   ├── main.go (updated)  # Added trending endpoints
│   └── pb_migrations/
│       └── 1700000002_trending_repos.js  # New collection
│
├── frontend/
│   └── src/
│       ├── app/
│       │   └── trending/
│       │       └── page.tsx  # New trending page
│       └── lib/
│           └── api.ts (updated)  # Added trending API methods
│
└── .github/workflows/
    └── collect-starred.yml (updated)  # Now collects trending too
```

## 🔌 New API Endpoints

### POST /api/github/trending/collect
Collect trending repositories

**Query Parameters:**
- `period` (optional): daily (default), weekly, or monthly

**Response:**
```json
{
  "period": "daily",
  "fetched": 25,
  "saved": 25,
  "snapshot_date": "2024-01-20",
  "message": "Trending repositories collected successfully"
}
```

### GET /api/trending/search
Search trending repositories

**Query Parameters:**
- `period`: daily/weekly/monthly (default: daily)
- `snapshot_date`: Filter by date
- `language`: Filter by language
- `min_stars`, `max_stars`: Star range filter
- `page`, `perPage`: Pagination

**Response:**
```json
{
  "page": 1,
  "perPage": 30,
  "items": [...]
}
```

### GET /api/trending/dates
Get all available snapshot dates

**Query Parameters:**
- `period`: daily/weekly/monthly

**Response:**
```json
{
  "period": "daily",
  "dates": ["2024-01-20", "2024-01-19", "2024-01-18"]
}
```

### GET /api/trending/languages
Get language statistics for a snapshot

**Query Parameters:**
- `period`: daily/weekly/monthly
- `snapshot_date`: Specific date

**Response:**
```json
{
  "languages": {
    "TypeScript": 10,
    "Python": 8,
    "Rust": 5
  }
}
```

## 🎨 Frontend Features

### Trending Page (/trending)

1. **Period Selection**
   - Daily, Weekly, Monthly tabs
   - Automatic date loading on period change

2. **Date Selection**
   - Dropdown with all available snapshot dates
   - Dates sorted newest first

3. **Language Filter**
   - Dynamic dropdown based on selected snapshot
   - Shows count for each language

4. **Repository Cards**
   - Rank badge (#1, #2, etc.)
   - Repository name and full name
   - Description
   - Star count with today's gain highlighted
   - Fork count
   - Language badge
   - Topic tags
   - External link to GitHub

5. **Collection Controls**
   - "Collect Trending" button
   - Loading states
   - Success/error messages

## 🔄 Automation

### Built-in Scheduler
```go
scheduler.MustAdd("collect_trending_repos", "0 1 * * *", func() {
    // Collects daily, weekly, and monthly at 1 AM UTC
})
```

### GitHub Actions
- Updated to collect trending data
- Runs daily at midnight UTC
- Exports to JSON files:
  - `trending_daily.json`
  - `trending_weekly.json`
  - `trending_monthly.json`

## 📊 Data Model

### TrendingRepo Collection

| Field | Type | Description |
|-------|------|-------------|
| id | string | Record ID |
| repo_id | number | GitHub repo ID |
| repo_name | string | Repository name |
| full_name | string | owner/repo |
| description | string | Description |
| html_url | string | Repository URL |
| star_num | number | Total stars |
| language | string | Primary language |
| fork_num | number | Fork count |
| tags | string | Comma-separated topics |
| trending_period | string | daily/weekly/monthly |
| snapshot_date | date | Collection date |
| stars_today | number | Stars gained |
| rank | number | Trending position |
| collected_at | timestamp | Collection timestamp |

### Indexes
- `idx_trending_period` - Filter by period
- `idx_snapshot_date` - Filter by date
- `idx_period_date` - Composite index for period + date
- `idx_star_num_trending` - Sort by stars
- `idx_language_trending` - Filter by language

## 🚀 Usage Examples

### Manual Collection
```bash
# Collect daily trending
curl -X POST http://localhost:8090/api/github/trending/collect?period=daily

# Collect weekly trending
curl -X POST "http://localhost:8090/api/github/trending/collect?period=weekly"

# Collect monthly trending
curl -X POST "http://localhost:8090/api/github/trending/collect?period=monthly"
```

### Search Examples
```bash
# Get today's daily trending
curl "http://localhost:8090/api/trending/search?period=daily&snapshot_date=2024-01-20"

# Get Python repos from weekly trending
curl "http://localhost:8090/api/trending/search?period=weekly&language=Python"

# Get available dates
curl "http://localhost:8090/api/trending/dates?period=daily"
```

### Frontend Navigation
- Home: http://localhost:3000 (Starred repos)
- Trending: http://localhost:3000/trending (Trending repos)

## 🔍 Implementation Highlights

### HTML Scraping
- Uses regex to parse GitHub's HTML
- Extracts repository details without API
- Handles different page layouts
- No rate limiting (unlike API)

### Snapshot System
- Each collection creates a snapshot
- Historical data preserved
- Compare trends over time
- Separate from starred repos

### Period Handling
- Daily: Last 24 hours
- Weekly: Last 7 days
- Monthly: Last 30 days
- Each period has its own snapshots

## 🎯 All Requirements Met

✅ Daily gather GitHub trending (Daily/Weekly/Monthly)  
✅ Save repo info with snapshot date  
✅ Separate table from Task 1  
✅ Page to show list for different dates  
✅ Job runs daily  

**Implementation Status: COMPLETE** ✅

## 📝 Notes

- Trending data is scraped from GitHub's HTML (no API limit)
- Each collection creates a new snapshot
- Old snapshots are preserved for historical analysis
- The scraper may need updates if GitHub changes their HTML structure
- Consider adding a cleanup job for very old snapshots

## 🔗 Integration with Task 1

- Both features share the same backend
- Same database (different tables)
- Same frontend framework
- Unified GitHub Actions workflow
- Shared UI components

## 📈 Future Enhancements

1. **Trend Analysis**
   - Compare repo positions over time
   - Track rising/falling stars
   - Visualize trends with charts

2. **Alerts**
   - Notify when a repo enters top 10
   - Track specific repositories

3. **Historical Comparison**
   - Side-by-side date comparison
   - Movement tracking

4. **Export Options**
   - CSV export
   - Report generation

5. **API Rate Limiting**
   - Add caching
   - Rate limit per endpoint
