# Full-Stack Trending Aggregator — Project Plan

## Overview
Build a complete trending content aggregator that pulls from GitHub Trending, GitHub Starred Repos, and Product Hunt. The system comprises:
1. **Go Backend** — CLI + TUI + REST API (Gin, GORM, SQLite/PostgreSQL)
2. **Web Frontend** — React + TypeScript + Tailwind + shadcn/ui + base-ui + 21st.dev

---

## Stage 1 — Backend (vibecoding-general-swarm)
**Skill**: `vibecoding-general-swarm`
**Goal**: Complete Go backend with all three interfaces (CLI, TUI, REST API)

### Sub-tasks:
- 1a. Project scaffold: Go modules, folder structure, config, Makefile
- 1b. Database layer: GORM models (Repo, Product, User), SQLite+PostgreSQL support, migrations
- 1c. GitHub service: Fetch trending repos (scraping + API fallback), fetch user starred repos
- 1d. Product Hunt service: Fetch trending products via Product Hunt API v2
- 1e. CLI interface: Cobra commands for `fetch`, `list`, `config`
- 1f. TUI interface: Bubble Tea interactive terminal UI for browsing data
- 1g. REST API: Gin routes, handlers, middleware, swagger docs
- 1h. Scheduler: Background cron jobs for auto-fetching data

### Output:
- `/mnt/agents/output/trending-backend/` — complete Go project

---

## Stage 2 — Web Frontend (vibecoding-webapp-swarm)
**Skill**: `vibecoding-webapp-swarm`
**Goal**: Modern React SPA consuming the Go REST API

### Sub-tasks:
- 2a. Project scaffold: Vite + React + TypeScript + Tailwind CSS
- 2b. Component setup: shadcn/ui init, base-ui, 21st.dev components
- 2c. Dashboard: Landing page with summary cards and navigation
- 2d. GitHub Trending page: Table/grid of trending repos with filters/sorting
- 2e. Starred Repos page: User starred repos explorer with search
- 2f. Product Hunt page: Trending products with votes/launches
- 2g. Settings page: API URL config, theme toggle, refresh intervals
- 2h. API integration: Fetch hooks, React Query or SWR, error handling

### Output:
- `/mnt/agents/output/trending-web/` — complete React project

---

## Stage 3 — Integration & Final Assembly
**Goal**: Wire everything together, test, and package

### Sub-tasks:
- 4a. Docker Compose: PostgreSQL + backend + frontend orchestration
- 4b. README: Complete documentation for all three components
- 4c. Environment configs: `.env` templates for all environments
- 4d. Build scripts: One-command build for entire stack

### Output:
- `/mnt/agents/output/` — complete project with Docker, docs, and build scripts
