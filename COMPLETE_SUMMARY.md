# GitHub Collectors - Complete Implementation

## Overview

This project implements two complementary features for GitHub repository tracking:

1. **Task 1**: GitHub Starred Repositories Collector
2. **Task 2**: GitHub Trending Repositories Collector

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Task 1: Starred Repositories](#task-1-starred-repositories)
- [Task 2: Trending Repositories](#task-2-trending-repositories)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Development](#development)

## Features

### Task 1: Starred Repositories
✅ Fetch GitHub starred repositories for any user  
✅ Save to local database  
✅ Web UI with advanced filtering  
✅ Star count range filter  
✅ Language filter  
✅ Tag/topic filter  
✅ Scheduled collection  
✅ GitHub Actions automation  

### Task 2: Trending Repositories
✅ Daily collection of trending repos  
✅ Support for Daily/Weekly/Monthly periods  
✅ Historical snapshots with dates  
✅ Separate database table  
✅ Web UI to view by date  
✅ Rank tracking  
✅ Stars gained tracking  

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  Starred Page    │    │  Trending Page   │          │
│  │  /               │    │  /trending       │          │
│  └──────────────────┘    └──────────────────┘          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Backend API (PocketBase + Go)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Custom Endpoints:                                │  │
│  │  - /api/github/starred/:username                  │  │
│  │  - /api/github/collect/:username                  │  │
│  │  - /api/github/trending/collect                   │  │
│  │  - /api/starred/search                            │  │
│  │  - /api/trending/search                           │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Cron Scheduler:                                  │  │
│  │  - Daily starred collection (0:00 UTC)            │  │
│  │  - Daily trending collection (1:00 UTC)           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Database (SQLite - PocketBase)              │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  starred_repos   │    │  trending_repos  │          │
│  │  - User repos    │    │  - Daily/Weekly  │          │
│  │  - Filters       │    │  - Snapshots     │          │
│  └──────────────────┘    └──────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- GitHub Personal Access Token (optional)

### Installation

```bash
# 1. Setup
./setup.sh

# 2. Configure
cp .env.example .env
# Edit .env with your GITHUB_TOKEN

# 3. Start Backend
cd backend
go run main.go serve

# 4. Start Frontend (new terminal)
cd frontend
npm install
npm run dev

# 5. Access
# Main App: http://localhost:3000
# Trending: http://localhost:3000/trending
# Backend:  http://localhost:8090
# Admin UI: http://localhost:8090/_/
```

## Task 1: Starred Repositories

### Features
- Collect starred repos from any GitHub user
- Advanced filtering (stars, language, tags)
- Responsive grid layout
- Real-time search
- Pagination support

### Usage

#### Via Web UI
1. Visit http://localhost:3000
2. Enter GitHub username (default: qdriven)
3. Click "Collect Repos"
4. Use filters to narrow down results

#### Via API
```bash
# Collect starred repos
curl -X POST http://localhost:8090/api/github/collect/qdriven

# Search with filters
curl "http://localhost:8090/api/starred/search?github_user=qdriven&min_stars=100&language=TypeScript"

# Get available languages
curl http://localhost:8090/api/starred/languages/qdriven
```

### Data Model

**Collection**: `starred_repos`

| Field | Type | Description |
|-------|------|-------------|
| github_user | text | GitHub username |
| repo_id | number | GitHub repository ID |
| repo_name | text | Repository name |
| full_name | text | owner/repo |
| description | text | Repository description |
| html_url | url | Repository URL |
| star_num | number | Total stars |
| language | text | Primary language |
| fork_num | number | Fork count |
| tags | text | Comma-separated topics |
| created_at | date | Repo creation date |
| updated_at | date | Last update |
| collected_at | date | Collection timestamp |

## Task 2: Trending Repositories

### Features
- Daily automated collection
- Three time periods: Daily, Weekly, Monthly
- Historical snapshots
- Rank tracking
- Stars gained tracking
- Date-based browsing

### Usage

#### Via Web UI
1. Visit http://localhost:3000/trending
2. Select period (Daily/Weekly/Monthly)
3. Choose snapshot date
4. Filter by language if needed
5. View ranked repositories

#### Via API
```bash
# Collect trending repos
curl -X POST "http://localhost:8090/api/github/trending/collect?period=daily"

# Search trending repos
curl "http://localhost:8090/api/trending/search?period=daily&snapshot_date=2024-01-20"

# Get available dates
curl "http://localhost:8090/api/trending/dates?period=daily"
```

### Data Model

**Collection**: `trending_repos`

| Field | Type | Description |
|-------|------|-------------|
| repo_id | number | GitHub repository ID |
| repo_name | text | Repository name |
| full_name | text | owner/repo |
| description | text | Description |
| html_url | url | Repository URL |
| star_num | number | Total stars |
| language | text | Primary language |
| fork_num | number | Fork count |
| tags | text | Topics |
| trending_period | select | daily/weekly/monthly |
| snapshot_date | date | Collection date |
| stars_today | number | Stars gained |
| rank | number | Trending position |
| collected_at | date | Collection timestamp |

## API Documentation

### Base URL
```
http://localhost:8090
```

### Starred Repositories Endpoints

#### GET /api/github/starred/:username
Fetch starred repos from GitHub (not saved)

#### POST /api/github/collect/:username
Fetch and save starred repos to database

#### GET /api/starred/search
Search starred repos with filters
- Parameters: `github_user`, `min_stars`, `max_stars`, `language`, `tag`, `page`, `perPage`

#### GET /api/starred/languages/:username
Get language statistics

#### GET /api/starred/tags/:username
Get tag statistics

### Trending Endpoints

#### POST /api/github/trending/collect
Collect trending repos
- Parameters: `period` (daily/weekly/monthly)

#### GET /api/trending/search
Search trending repos
- Parameters: `period`, `snapshot_date`, `language`, `min_stars`, `max_stars`, `page`, `perPage`

#### GET /api/trending/dates
Get available snapshot dates
- Parameters: `period`

#### GET /api/trending/languages
Get language statistics
- Parameters: `period`, `snapshot_date`

## Deployment

### Docker Deployment

```bash
# Build and deploy
./deploy.sh

# Or manually
docker-compose up -d
```

### Manual Deployment

```bash
# Build
./build.sh

# Run backend
cd backend
./github-collector serve

# Run frontend
cd frontend
npm start
```

### GitHub Actions

The repository includes automated workflows:
- Daily collection at midnight UTC
- Collects both starred and trending repos
- Exports data to JSON files
- Commits changes automatically

## Development

### Project Structure

```
github-collectors/
├── backend/
│   ├── main.go                    # Main application
│   ├── go.mod                     # Go dependencies
│   └── pb_migrations/             # Database migrations
│       ├── 1700000000_starred_repos.js
│       ├── 1700000001_collection_configs.js
│       └── 1700000002_trending_repos.js
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Starred repos page
│   │   │   ├── layout.tsx         # Root layout
│   │   │   ├── globals.css        # Styles
│   │   │   └── trending/
│   │   │       └── page.tsx       # Trending repos page
│   │   ├── components/ui/         # UI components
│   │   └── lib/
│   │       ├── api.ts             # API client
│   │       └── utils.ts           # Utilities
│   ├── package.json
│   └── tsconfig.json
│
├── .github/workflows/
│   └── collect-starred.yml        # GitHub Action
│
├── API.md                         # API documentation
├── README.md                      # Project overview
├── IMPLEMENTATION.md              # Implementation details
├── TASK1_SUMMARY.md               # Task 1 summary
├── TASK2_SUMMARY.md               # Task 2 summary
│
├── build.sh                       # Build script
├── setup.sh                       # Setup script
├── deploy.sh                      # Deployment script
├── test.sh                        # Test script
│
├── Dockerfile.backend             # Backend Docker
├── Dockerfile.frontend            # Frontend Docker
│
├── .env.example                   # Environment template
└── .gitignore                     # Git ignore rules
```

### Key Technologies

**Backend:**
- PocketBase (Go)
- SQLite
- Cron scheduler
- HTML scraper

**Frontend:**
- Next.js 14
- TypeScript
- shadcn-ui
- Tailwind CSS
- Axios

**Automation:**
- GitHub Actions
- Docker

### Scripts

```bash
./setup.sh      # Initial setup
./build.sh      # Build application
./deploy.sh     # Deploy with Docker
./test.sh       # Run tests
```

## Monitoring & Logging

### Backend Logs
```go
app.Logger().Info("Collecting repos", "username", username)
app.Logger().Error("Failed to fetch", "error", err)
```

### Frontend Logs
- Console logging in development
- Error boundaries for production
- Network error handling

## Security

- Environment variables for secrets
- No hardcoded credentials
- GitHub token support
- Input validation
- CORS configuration

## Performance

- Indexed database fields
- Pagination support
- Efficient queries
- Lazy loading
- Batch inserts

## Troubleshooting

### Common Issues

1. **Backend won't start**
   - Check port 8090 availability
   - Verify Go installation
   - Check pb_data permissions

2. **Frontend can't connect**
   - Verify NEXT_PUBLIC_API_URL
   - Check backend is running
   - Review CORS settings

3. **GitHub API errors**
   - Set GITHUB_TOKEN
   - Check rate limits
   - Validate username

4. **No trending data**
   - Run collection manually
   - Check scraper logs
   - Verify GitHub HTML structure

## Future Enhancements

1. **Authentication** - User login for private collections
2. **Analytics** - Trend analysis and charts
3. **Alerts** - Notifications for new trending repos
4. **Export** - CSV/JSON export options
5. **Comparison** - Compare repos across dates
6. **Recommendations** - ML-based suggestions
7. **Mobile** - React Native app
8. **GraphQL** - Alternative API

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests: `./test.sh`
5. Submit pull request

## License

MIT

## Support

For issues and feature requests, please create an issue in the repository.

---

**Implementation Status: COMPLETE** ✅

Both Task 1 and Task 2 have been fully implemented with all requirements met.
