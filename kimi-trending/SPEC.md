# SPEC.md — Trending Aggregator Platform

## System Overview

A full-stack trending content aggregator platform that collects and presents:
- **GitHub Trending Repositories** — daily/weekly trending repos by language
- **GitHub User Starred Repos** — a user's starred repositories with search/filter
- **Product Hunt Trending** — trending product launches with votes and categories

The system comprises three components:
1. **Go Backend** — CLI + TUI + REST API service
2. **React Web Frontend** — Dashboard UI consuming the REST API
3. **Tauri Desktop App** — Native desktop wrapper around the web frontend

---

## Backend Architecture (Go)

### Project Structure
```
trending-backend/
├── cmd/
│   ├── api/              # REST API entry point
│   │   └── main.go       # Gin server bootstrap
│   ├── cli/              # CLI entry point
│   │   └── main.go       # Cobra CLI bootstrap
│   └── tui/              # TUI entry point
│       └── main.go       # Bubble Tea TUI bootstrap
├── internal/
│   ├── config/           # Configuration management
│   ├── db/               # Database connection & migrations
│   ├── models/           # GORM models
│   ├── services/         # Business logic (GitHub, ProductHunt)
│   ├── api/              # HTTP handlers, middleware
│   ├── cli/              # CLI commands
│   └── tui/              # TUI views & components
├── pkg/
│   ├── github/           # GitHub API client
│   └── producthunt/      # Product Hunt API client
├── scripts/
├── Makefile
├── go.mod
├── go.sum
├── .env.example
└── README.md
```

### Technology Stack
- **Language**: Go 1.22+
- **Web Framework**: Gin v1.9+
- **ORM**: GORM v2
- **Databases**: SQLite3 (default), PostgreSQL (production)
- **CLI**: Cobra v1.8+
- **TUI**: Bubble Tea v0.25+, Bubbles, Lipgloss
- **Scheduler**: go-co-op/gocron v2
- **HTTP Client**: resty/v2
- **Config**: godotenv + env tags
- **Logging**: slog (stdlib)
- **Docs**: swaggo/swag (Swagger)

### Configuration

```go
// internal/config/config.go
type Config struct {
    // Database
    DBDriver   string `env:"DB_DRIVER" envDefault:"sqlite"`   // sqlite | postgres
    DBHost     string `env:"DB_HOST" envDefault:"localhost"`
    DBPort     int    `env:"DB_PORT" envDefault:"5432"`
    DBUser     string `env:"DB_USER" envDefault:"trending"`
    DBPassword string `env:"DB_PASSWORD" envDefault:""`
    DBName     string `env:"DB_NAME" envDefault:"trending.db"`
    DBSSLMode  string `env:"DB_SSL_MODE" envDefault:"disable"`
    
    // API Server
    APIHost           string `env:"API_HOST" envDefault:"0.0.0.0"`
    APIPort           int    `env:"API_PORT" envDefault:"8080"`
    APIReadTimeout    int    `env:"API_READ_TIMEOUT" envDefault:"30"`
    APIWriteTimeout   int    `env:"API_WRITE_TIMEOUT" envDefault:"30"`
    
    // GitHub
    GitHubToken       string `env:"GITHUB_TOKEN" envDefault:""`
    GitHubAPIURL      string `env:"GITHUB_API_URL" envDefault:"https://api.github.com"`
    
    // Product Hunt
    ProductHuntToken  string `env:"PRODUCTHUNT_TOKEN" envDefault:""`
    ProductHuntAPIURL string `env:"PRODUCTHUNT_API_URL" envDefault:"https://api.producthunt.com/v2/api/graphql"`
    
    // Scheduler
    FetchInterval     int    `env:"FETCH_INTERVAL" envDefault:"3600"` // seconds
    
    // TUI
    TUIRefreshRate    int    `env:"TUI_REFRESH_RATE" envDefault:"5"` // seconds
}
```

### Database Models

```go
// internal/models/github_trending.go
package models

import "time"

type GitHubTrending struct {
    ID              uint      `gorm:"primaryKey" json:"id"`
    RepoName        string    `gorm:"not null;index" json:"repo_name"`
    Owner           string    `gorm:"not null" json:"owner"`
    FullName        string    `gorm:"not null;uniqueIndex:idx_gh_trending_fullname_date" json:"full_name"`
    Description     string    `json:"description"`
    Language        string    `gorm:"index" json:"language"`
    Stars           int       `json:"stars"`
    StarsToday      int       `json:"stars_today"`
    Forks           int       `json:"forks"`
    Period          string    `gorm:"not null;index;uniqueIndex:idx_gh_trending_fullname_date" json:"period"` // daily | weekly | monthly
    FetchedAt       time.Time `gorm:"not null;index;uniqueIndex:idx_gh_trending_fullname_date" json:"fetched_at"`
    URL             string    `json:"url"`
    Contributors    int       `json:"contributors"`
    CreatedAt       time.Time `json:"created_at"`
    UpdatedAt       time.Time `json:"updated_at"`
}

// internal/models/github_starred.go
type GitHubStarred struct {
    ID          uint      `gorm:"primaryKey" json:"id"`
    RepoName    string    `gorm:"not null" json:"repo_name"`
    Owner       string    `gorm:"not null" json:"owner"`
    FullName    string    `gorm:"not null;uniqueIndex:idx_gh_starred_fullname_user" json:"full_name"`
    Username    string    `gorm:"not null;index;uniqueIndex:idx_gh_starred_fullname_user" json:"username"`
    Description string    `json:"description"`
    Language    string    `gorm:"index" json:"language"`
    Stars       int       `json:"stars"`
    Forks       int       `json:"forks"`
    StarredAt   time.Time `json:"starred_at"`
    Topics      string    `json:"topics"` // JSON array as string
    URL         string    `json:"url"`
    Private     bool      `json:"private"`
    FetchedAt   time.Time `gorm:"not null" json:"fetched_at"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

// internal/models/product_hunt.go
type ProductHunt struct {
    ID              uint      `gorm:"primaryKey" json:"id"`
    ProductID       string    `gorm:"not null;uniqueIndex:idx_ph_product_date" json:"product_id"`
    Name            string    `gorm:"not null" json:"name"`
    Tagline         string    `json:"tagline"`
    Description     string    `json:"description"`
    URL             string    `json:"url"`
    Thumbnail       string    `json:"thumbnail"`
    VotesCount      int       `json:"votes_count"`
    CommentsCount   int       `json:"comments_count"`
    Makers          string    `json:"makers"` // JSON array as string
    Topics          string    `json:"topics"` // JSON array as string
    Day             time.Time `gorm:"not null;index;uniqueIndex:idx_ph_product_date" json:"day"`
    Featured        bool      `json:"featured"`
    FetchedAt       time.Time `gorm:"not null" json:"fetched_at"`
    CreatedAt       time.Time `json:"created_at"`
    UpdatedAt       time.Time `json:"updated_at"`
}
```

### API Endpoints (REST)

Base path: `/api/v1`

#### GitHub Trending
- `GET /api/v1/github/trending` — List trending repos
  - Query: `period` (daily|weekly|monthly), `language` (filter), `limit` (default 30), `offset`
  - Response: `{ "data": [...], "total": N, "limit": 30, "offset": 0 }`
- `GET /api/v1/github/trending/languages` — Get all available languages
- `POST /api/v1/github/trending/fetch` — Trigger manual fetch
  - Body: `{ "period": "daily", "language": "go" }`

#### GitHub Starred
- `GET /api/v1/github/starred/:username` — List user's starred repos
  - Query: `language`, `limit`, `offset`, `sort` (starred_at|stars)
  - Response: `{ "data": [...], "total": N, "limit": 30, "offset": 0 }`
- `POST /api/v1/github/starred/fetch` — Fetch starred repos for user
  - Body: `{ "username": "octocat" }`
- `GET /api/v1/github/starred/:username/languages` — Language breakdown for user's stars

#### Product Hunt
- `GET /api/v1/producthunt/trending` — List trending products
  - Query: `day` (YYYY-MM-DD), `limit`, `offset`
  - Response: `{ "data": [...], "total": N, "limit": 30, "offset": 0 }`
- `GET /api/v1/producthunt/categories` — Get product categories/topics
- `POST /api/v1/producthunt/fetch` — Trigger manual fetch
  - Body: `{ "day": "2024-01-01" }`

#### System
- `GET /api/v1/health` — Health check
- `GET /api/v1/stats` — Dashboard statistics (counts, last fetch times)
- `GET /swagger/*any` — Swagger UI

### CLI Commands (Cobra)

```
trending-cli fetch github-trending [--period daily|weekly|monthly] [--language go] [--limit 100]
trending-cli fetch github-starred <username> [--limit 100]
trending-cli fetch producthunt [--day 2024-01-01] [--limit 100]
trending-cli list github-trending [--period daily] [--language go] [--limit 30]
trending-cli list github-starred <username> [--language go] [--limit 30]
trending-cli list producthunt [--day 2024-01-01] [--limit 30]
trending-cli serve [--port 8080] [--host 0.0.0.0]          # Start API server
trending-cli scheduler start                                  # Start background scheduler
trending-cli scheduler stop
trending-cli config show                                      # Show current config
```

### TUI (Bubble Tea)

The TUI is an interactive terminal dashboard with these views:
- **Dashboard Tab**: Summary stats with ascii charts (total repos, products, last fetch)
- **GitHub Trending Tab**: Interactive table of trending repos with filtering by language/period
- **GitHub Starred Tab**: User input → table of starred repos with search
- **Product Hunt Tab**: Table of trending products with vote counts
- **Fetch Tab**: Trigger fetches with status/progress indicators
- **Help Tab**: Keyboard shortcuts and usage info

Key bindings:
- `Tab` / `Shift+Tab` — Switch tabs
- `j` / `k` or `↑` / `↓` — Navigate rows
- `/` — Search/filter
- `r` — Refresh data
- `f` — Fetch new data
- `q` / `Ctrl+C` — Quit

### Services

```go
// internal/services/interfaces.go
package services

type GitHubService interface {
    FetchTrending(ctx context.Context, period, language string, limit int) ([]models.GitHubTrending, error)
    FetchUserStarred(ctx context.Context, username string, limit int) ([]models.GitHubStarred, error)
    GetTrending(ctx context.Context, period, language string, limit, offset int) ([]models.GitHubTrending, int64, error)
    GetStarred(ctx context.Context, username, language string, limit, offset int, sort string) ([]models.GitHubStarred, int64, error)
    GetLanguages(ctx context.Context) ([]string, error)
    GetUserLanguages(ctx context.Context, username string) (map[string]int, error)
}

type ProductHuntService interface {
    FetchTrending(ctx context.Context, day string, limit int) ([]models.ProductHunt, error)
    GetTrending(ctx context.Context, day string, limit, offset int) ([]models.ProductHunt, int64, error)
    GetCategories(ctx context.Context) ([]string, error)
}
```

### Scheduler

- Fetch GitHub trending every hour (configurable)
- Product Hunt trending every 2 hours
- Configurable via `FETCH_INTERVAL` env var
- Background goroutine with graceful shutdown

---

## Frontend Architecture (React)

### Tech Stack
- **Framework**: React 19 + TypeScript
- **Bundler**: Vite v7.2.4
- **Styling**: Tailwind CSS v3.4.19
- **UI Components**: shadcn/ui + @base-ui-components/react + @21st-dev/ui
- **Routing**: React Router v7 (HashRouter)
- **State**: React Query (TanStack Query) v5
- **Icons**: Lucide React
- **Charts**: Recharts
- **Animations**: Framer Motion

### Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Summary cards, recent activity, quick stats |
| `/github-trending` | GitHub Trending | Filterable table of trending repos |
| `/github-starred` | GitHub Starred | User starred repos explorer |
| `/product-hunt` | Product Hunt | Trending products grid |
| `/settings` | Settings | API URL, theme, refresh interval |

### API Integration

All API calls go through a configured base URL (default: `http://localhost:8080/api/v1`):

```typescript
// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const api = {
  // GitHub Trending
  getTrending: (params) => fetch(`${API_BASE}/github/trending?${qs(params)}`),
  getLanguages: () => fetch(`${API_BASE}/github/trending/languages`),
  fetchTrending: (body) => fetch(`${API_BASE}/github/trending/fetch`, { method: 'POST', body }),
  
  // GitHub Starred
  getStarred: (username, params) => fetch(`${API_BASE}/github/starred/${username}?${qs(params)}`),
  fetchStarred: (body) => fetch(`${API_BASE}/github/starred/fetch`, { method: 'POST', body }),
  
  // Product Hunt
  getProductHunt: (params) => fetch(`${API_BASE}/producthunt/trending?${qs(params)}`),
  fetchProductHunt: (body) => fetch(`${API_BASE}/producthunt/fetch`, { method: 'POST', body }),
  
  // Stats
  getStats: () => fetch(`${API_BASE}/stats`),
};
```

### Component Design System

- **Cards**: Use shadcn/ui Card with subtle borders, rounded-xl
- **Tables**: shadcn/ui Table with sortable headers, pagination
- **Buttons**: shadcn/ui Button with variants (default, outline, ghost)
- **Inputs**: shadcn/ui Input + Select for filters
- **Theme**: Dark mode default, slate/zinc color palette
- **Layout**: Sidebar navigation (collapsible) + main content area

---

## Desktop Architecture (Tauri)

### Tech Stack
- **Framework**: Tauri v2 (Rust)
- **Frontend**: Same React app as web frontend (built as static files)
- **Bundling**: Tauri bundles the web assets into the desktop app

### Tauri Configuration

```json
// src-tauri/tauri.conf.json
{
  "productName": "Trending Aggregator",
  "identifier": "com.trending.app",
  "build": {
    "frontendDist": "../../trending-web/dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "windows": [
      {
        "title": "Trending Aggregator",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "center": true,
        "decorations": true
      }
    ]
  }
}
```

### Native Integrations
- System tray icon with menu (Show / Hide / Quit)
- Native menu bar
- Keyboard shortcuts: `Cmd/Ctrl+R` refresh, `Cmd/Ctrl+1-4` tab switching
- Auto-updater configuration placeholder
- Single instance enforcement

---

## Data Flow

```
GitHub API ──┐
             ├──→ Go Backend (fetchers) ──→ Database (SQLite/PostgreSQL)
ProductHunt ─┘                              ↑
                                            │
React Web/TUI/CLI ←── REST API/DB queries ←─┘
     │
Tauri (desktop wrapper)
```

### Fetch Flow
1. Scheduler triggers or user manually triggers a fetch
2. Service calls external API (GitHub/ProductHunt) with authentication tokens
3. Data normalized into internal models
4. Upserted into database with conflict resolution
5. Stats endpoint reflects new data

### API Flow
1. Frontend requests data from REST API
2. Handler queries database via GORM
3. Results paginated and returned as JSON
4. Frontend caches via React Query

---

## Environment Variables

```bash
# Database
DB_DRIVER=sqlite           # sqlite | postgres
DB_NAME=trending.db        # For SQLite: file path
DB_HOST=localhost          # For PostgreSQL
DB_PORT=5432
DB_USER=trending
DB_PASSWORD=secret
DB_SSL_MODE=disable

# API
API_HOST=0.0.0.0
API_PORT=8080

# External APIs
GITHUB_TOKEN=ghp_xxx       # GitHub Personal Access Token
PRODUCTHUNT_TOKEN=xxx      # Product Hunt Developer Token

# Scheduler
FETCH_INTERVAL=3600        # seconds

# Frontend
VITE_API_URL=http://localhost:8080/api/v1
```

---

## Build & Run

### Backend
```bash
cd trending-backend
make deps    # Download Go modules
make build   # Build all binaries (api, cli, tui)
make run-api # Run API server
make test    # Run tests
```

### Frontend
```bash
cd trending-web
npm install
npm run dev    # Development server
npm run build  # Production build
```

### Desktop
```bash
cd trending-desktop
npm install          # Install frontend deps
cargo tauri dev      # Development mode
cargo tauri build    # Build desktop app
```

### Docker
```bash
docker-compose up -d  # PostgreSQL + Backend + Frontend
```
