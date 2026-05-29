# Trending Aggregator

A full-stack trending content aggregator platform that collects and presents data from **GitHub Trending Repositories**, **GitHub User Starred Repos**, and **Product Hunt** — available as a REST API, CLI tool, TUI dashboard, and web application.

## System Architecture

```
 +-----------------------------------------------------------+
 |                 Web Frontend (React)                     |
 |  +----------------+ +----------------+ +----------+      |
 |  | GitHub Trending| | GitHub Starred | | Product  |      |
 |  +----------------+ +----------------+ |  Hunt    |      |
 |  +----------------+ +----------------+ +----------+      |
 |  |   Dashboard    | |   Settings     | |          |      |
 |  +----------------+ +----------------+ +----------+      |
 +-----------------------------------------------------------+
                            |
                            v
 +-----------------------------------------------------------+
 |              Go Backend (Gin REST API)                     |
 |  +------------------+  +------------------+               |
 |  | GitHub Service   |  | ProductHunt Svc  |               |
 |  | - Trending       |  | - Trending       |               |
 |  | - Starred        |  | - Categories     |               |
 |  +------------------+  +------------------+               |
 |  +------------------+  +------------------+               |
 |  | CLI (Cobra)      |  | TUI (Bubble Tea) |               |
 |  | - fetch/list     |  | - Interactive    |               |
 |  | - serve/config   |  |   terminal UI    |               |
 |  +------------------+  +------------------+               |
 +-----------------------------------------------------------+
                            |
              +-------------+-------------+
              |                           |
              v                           v
 +----------------------+  +----------------------------+
 | SQLite (development)  |  | PostgreSQL (production)    |
 +----------------------+  +----------------------------+
```

## Quick Start

### Prerequisites
- Go 1.22+
- Node.js 20+
- Docker & Docker Compose (optional)

### Option 1: Docker Compose (Recommended)

```bash
# Start everything (PostgreSQL + Backend + Frontend)
export GITHUB_TOKEN=your_github_token
export PRODUCTHUNT_TOKEN=your_producthunt_token
docker-compose up -d

# Access:
# Frontend: http://localhost
# API: http://localhost:8080/api/v1
# Swagger: http://localhost:8080/swagger/index.html
```

### Option 2: Run Backend + Frontend Separately

```bash
# Terminal 1: Start Backend
cd trending-backend
cp .env.example .env
# Edit .env with your API tokens
go run ./cmd/api

# Terminal 2: Start Frontend
cd trending-web
npm install
npm run dev
```

### Option 3: CLI Tool

```bash
cd trending-backend
go run ./cmd/cli fetch github-trending --period daily
go run ./cmd/cli list github-trending
go run ./cmd/cli serve  # Start API server via CLI
```

### Option 4: TUI (Terminal UI)

```bash
cd trending-backend
go run ./cmd/tui
```

## Project Structure

```
trending-aggregator/
├── trending-backend/        # Go Backend Service
│   ├── cmd/
│   │   ├── api/             # REST API entry point
│   │   ├── cli/             # CLI tool entry point
│   │   └── tui/             # TUI entry point
│   ├── internal/
│   │   ├── api/             # Gin handlers, routes, middleware
│   │   ├── cli/             # Cobra commands
│   │   ├── config/          # Environment configuration
│   │   ├── db/              # GORM database connection
│   │   ├── models/          # GORM models
│   │   ├── services/        # Business logic
│   │   └── tui/             # Bubble Tea TUI components
│   ├── pkg/
│   │   ├── github/          # GitHub API client
│   │   └── producthunt/     # Product Hunt API client
│   ├── Dockerfile
│   ├── Makefile
│   └── go.mod
│
├── trending-web/            # React Web Frontend
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # React Query hooks
│   │   ├── lib/             # API client + mock data
│   │   └── types/           # TypeScript types
│   ├── Dockerfile
│   └── package.json
│
└── docker-compose.yml
```

## API Endpoints

Base URL: `http://localhost:8080/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/stats` | Dashboard statistics |
| GET | `/github/trending` | List trending repos |
| GET | `/github/trending/languages` | Get all languages |
| POST | `/github/trending/fetch` | Fetch trending repos |
| GET | `/github/starred/:username` | List user's starred repos |
| POST | `/github/starred/fetch` | Fetch starred repos |
| GET | `/github/starred/:username/languages` | Language breakdown |
| GET | `/producthunt/trending` | List trending products |
| GET | `/producthunt/categories` | Get categories |
| POST | `/producthunt/fetch` | Fetch Product Hunt |
| GET | `/swagger/index.html` | Swagger UI |

## CLI Commands

```bash
# Fetch data
trending-cli fetch github-trending [--period daily|weekly|monthly] [--language go]
trending-cli fetch github-starred <username>
trending-cli fetch producthunt [--day 2024-01-01]

# List stored data
trending-cli list github-trending [--period daily] [--language go]
trending-cli list github-starred <username>
trending-cli list producthunt [--day 2024-01-01]

# Start API server
trending-cli serve [--port 8080]

# Configuration
trending-cli config show
```

## TUI Key Bindings

| Key | Action |
|-----|--------|
| Tab / Shift+Tab | Switch tabs |
| j/k or Up/Down | Navigate rows |
| / | Search/filter |
| r | Refresh data |
| f | Fetch new data |
| q / Ctrl+C | Quit |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_DRIVER` | sqlite | Database: sqlite or postgres |
| `DB_NAME` | trending.db | SQLite file / PostgreSQL DB name |
| `API_PORT` | 8080 | API server port |
| `GITHUB_TOKEN` | - | GitHub Personal Access Token |
| `PRODUCTHUNT_TOKEN` | - | Product Hunt Developer Token |
| `FETCH_INTERVAL` | 3600 | Auto-fetch interval (seconds) |

## Technology Stack

### Backend
- **Go 1.22** with standard library
- **Gin** - Web framework
- **GORM** - ORM for SQLite & PostgreSQL
- **Cobra** - CLI framework
- **Bubble Tea** - TUI framework
- **go-co-op/gocron** - Background scheduler

### Frontend
- **React 19 + TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **TanStack Query** - Data fetching
- **Recharts** - Charts
- **Framer Motion** - Animations

## License

MIT
