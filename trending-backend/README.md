# Trending Aggregator — Backend

Go backend for the Trending Aggregator platform. Provides REST API, CLI tool, and TUI dashboard for collecting GitHub trending repos, starred repos, and Product Hunt products.

## Quick Start

```bash
cp .env.example .env
# Add GITHUB_TOKEN and PRODUCTHUNT_TOKEN

# REST API
go run ./cmd/api                    # → http://localhost:8080

# CLI
go run ./cmd/cli fetch github-trending --period daily
go run ./cmd/cli list github-starred <username>

# TUI
go run ./cmd/tui
```

## API

Base URL: `http://localhost:8080/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/stats` | Dashboard statistics |
| GET | `/github/trending` | List trending repos |
| POST | `/github/trending/fetch` | Fetch trending repos |
| GET | `/github/starred/:username` | List user's starred repos |
| POST | `/github/starred/fetch` | Fetch starred repos |
| GET | `/producthunt/trending` | List trending products |
| POST | `/producthunt/fetch` | Fetch Product Hunt data |
| GET | `/swagger/index.html` | Swagger UI |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_DRIVER` | `sqlite` | `sqlite` or `postgres` |
| `DB_NAME` | `trending.db` | Database name |
| `API_PORT` | `8080` | API server port |
| `GITHUB_TOKEN` | — | GitHub PAT |
| `PRODUCTHUNT_TOKEN` | — | Product Hunt dev token |
| `FETCH_INTERVAL` | `3600` | Auto-fetch interval (seconds) |
