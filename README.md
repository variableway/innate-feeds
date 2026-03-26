# GitHub Starred Repositories Collector

A full-stack application to collect, store, and view GitHub starred repositories with advanced filtering capabilities.

## Features

- ✅ Fetch and store GitHub starred repositories
- ✅ Advanced filtering by stars, language, and tags
- ✅ Scheduled automatic collection
- ✅ Web UI for easy viewing and searching
- ✅ RESTful API for programmatic access
- ✅ GitHub Actions integration for automated collection

## Tech Stack

### Backend
- **PocketBase** - Go-based backend as a service
- **GitHub API** - Fetch starred repositories
- **SQLite** - Embedded database

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **shadcn-ui** - Beautiful UI components
- **Tailwind CSS** - Styling
- **Axios** - HTTP client

### Automation
- **GitHub Actions** - Scheduled collection
- **Docker** - Containerization

## Project Structure

```
github-collectors/
├── backend/
│   ├── main.go                 # Main application entry
│   ├── go.mod                  # Go dependencies
│   ├── pb_migrations/          # Database migrations
│   └── pb_data/               # PocketBase data (created at runtime)
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/        # React components
│   │   └── lib/               # Utilities and API client
│   ├── package.json
│   └── tsconfig.json
├── .github/
│   └── workflows/
│       └── collect-starred.yml # GitHub Action workflow
├── API.md                      # API documentation
├── build.sh                    # Build script
├── setup.sh                    # Setup script
├── deploy.sh                   # Deployment script
├── Dockerfile.backend         # Backend Docker image
└── Dockerfile.frontend        # Frontend Docker image
```

## Quick Start

### Prerequisites

- Go 1.21 or later
- Node.js 18 or later
- GitHub Personal Access Token (optional, for higher rate limits)

### Installation

1. **Clone and setup:**
   ```bash
   cd github-collectors
   chmod +x *.sh
   ./setup.sh
   ```

2. **Configure environment:**
   ```bash
   # Edit .env file with your GitHub token
   GITHUB_TOKEN=your_github_token_here
   NEXT_PUBLIC_API_URL=http://localhost:8090
   ```

3. **Start the backend:**
   ```bash
   cd backend
   go run main.go serve
   ```

4. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8090
   - PocketBase Admin: http://localhost:8090/_/

## Usage

### Web Interface

1. Open http://localhost:3000
2. Enter a GitHub username (default: qdriven)
3. Click "Collect Repos" to fetch starred repositories
4. Use filters to search by:
   - Star count range
   - Programming language
   - Tags/topics

### API Usage

See [API.md](./API.md) for complete API documentation.

Quick examples:

```bash
# Collect starred repos
curl -X POST http://localhost:8090/api/github/collect/qdriven

# Search with filters
curl "http://localhost:8090/api/starred/search?github_user=qdriven&min_stars=100&language=TypeScript"
```

### Scheduled Collection

1. Access PocketBase admin at http://localhost:8090/_/
2. Create a new collection config in `collection_configs`
3. Set `github_user` and `enabled` to `true`
4. The system will collect daily at midnight UTC

### GitHub Actions

The repository includes a GitHub Action workflow that:
- Runs daily at midnight UTC
- Collects starred repositories for configured users
- Saves data to a JSON file
- Commits changes to the repository

To enable:
1. Push this repository to GitHub
2. Set `GITHUB_TOKEN` secret in repository settings
3. The workflow will run automatically or can be triggered manually

## Development

### Build

```bash
./build.sh
```

### Test

```bash
./test.sh
```

### Docker Deployment

```bash
./deploy.sh
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | None |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8090` |
| `BACKEND_PORT` | Backend server port | `8090` |
| `FRONTEND_PORT` | Frontend server port | `3000` |

### PocketBase Collections

1. **starred_repos** - Stores collected repositories
2. **collection_configs** - Scheduled collection configuration

## API Endpoints

- `GET /api/github/starred/:username` - Fetch starred repos
- `POST /api/github/collect/:username` - Collect and save repos
- `GET /api/starred/search` - Search with filters
- `GET /api/starred/languages/:username` - Get language statistics
- `GET /api/starred/tags/:username` - Get tag statistics

See [API.md](./API.md) for detailed documentation.

## Architecture

### Backend Flow

1. User triggers collection via API or scheduled job
2. Backend fetches all starred repos from GitHub (with pagination)
3. Repos are saved to PocketBase database
4. Data is available for search and filtering

### Frontend Flow

1. User enters GitHub username
2. Frontend calls backend API to collect or search
3. Results are displayed with filtering options
4. Real-time updates as user applies filters

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `./test.sh`
5. Submit a pull request

## License

MIT

## Support

For issues and feature requests, please create an issue in the repository.
