# Implementation Details - GitHub Starred Repositories Collector

## Architecture Overview

This is a full-stack application built with modern technologies for collecting, storing, and viewing GitHub starred repositories.

### System Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   GitHub API    │◄──────┤  Backend (Go)    │◄──────┤  Frontend (Next)│
│                 │       │  PocketBase      │       │  React + TS     │
└─────────────────┘       └──────────────────┘       └─────────────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │   SQLite DB  │
                          │  (PocketBase)│
                          └──────────────┘
```

## Technology Stack

### Backend (Go + PocketBase)
- **PocketBase**: Go-based backend-as-a-service with built-in database
- **GitHub API Client**: Custom implementation for fetching starred repos
- **Cron Scheduler**: Built-in job scheduling for automated collection
- **RESTful API**: Custom endpoints extending PocketBase

### Frontend (Next.js + TypeScript)
- **Next.js 14**: React framework with App Router
- **TypeScript**: Full type safety
- **shadcn-ui**: Pre-built accessible UI components
- **Tailwind CSS**: Utility-first styling
- **Axios**: HTTP client for API calls

## Data Models

### StarredRepo Collection

```javascript
{
  id: string,              // PocketBase record ID
  github_user: string,     // GitHub username
  repo_id: number,         // GitHub repository ID
  repo_name: string,       // Repository name
  full_name: string,       // owner/repo format
  description: string,     // Repository description
  html_url: string,        // Repository URL
  star_num: number,        // Star count
  language: string,        // Primary language
  fork_num: number,        // Fork count
  tags: string,           // Comma-separated topics
  created_at: timestamp,   // Repo creation date
  updated_at: timestamp,   // Last update date
  pushed_at: timestamp,    // Last push date
  collected_at: timestamp  // Data collection date
}
```

### CollectionConfig Collection

```javascript
{
  id: string,              // PocketBase record ID
  github_user: string,     // GitHub username
  enabled: boolean,        // Scheduled collection enabled
  schedule: string,        // Cron schedule
  last_collected: timestamp // Last collection time
}
```

## API Implementation

### 1. Fetch Starred Repositories
**Endpoint**: `GET /api/github/starred/:username`

**Implementation**:
- Uses GitHub REST API v3
- Implements pagination (100 items per page)
- Supports authentication via GITHUB_TOKEN env var
- Returns all starred repos for a user

**Code Flow**:
```go
func fetchGitHubStarredRepos(username string) ([]GitHubRepo, error) {
    // Paginate through all starred repos
    // Build request with proper headers
    // Handle rate limiting
    // Return all repos
}
```

### 2. Collect Starred Repositories
**Endpoint**: `POST /api/github/collect/:username`

**Implementation**:
- Fetches repos from GitHub
- Transforms data to match database schema
- Upserts records (avoids duplicates)
- Returns collection statistics

**Key Features**:
- Batch insert for performance
- Automatic tag conversion (array to comma-separated string)
- Timestamp conversion (GitHub API to PocketBase format)
- Error handling for partial failures

### 3. Search Starred Repositories
**Endpoint**: `GET /api/starred/search`

**Implementation**:
- Uses PocketBase's filter expressions
- Supports multiple filter criteria:
  - `min_stars`, `max_stars`: Numeric range filter
  - `language`: Exact match
  - `tag`: Partial match using `~` operator
- Implements pagination
- Sorts by star count (descending)

**Filter Expression Example**:
```go
expr := fmt.Sprintf("github_user = '%s'", username)
if minStars != "" {
    expr += fmt.Sprintf(" && star_num >= %s", minStars)
}
// Additional filters...
```

### 4. Get Languages
**Endpoint**: `GET /api/starred/languages/:username`

**Implementation**:
- Fetches all repos for user
- Aggregates language counts
- Returns as key-value map

### 5. Get Tags
**Endpoint**: `GET /api/starred/tags/:username`

**Implementation**:
- Parses comma-separated tags
- Counts tag occurrences
- Returns as key-value map

## Frontend Implementation

### Main Page Components

1. **User Input Section**
   - Username input field
   - Collect repos button
   - Real-time search

2. **Filter Section**
   - Star range inputs (min/max)
   - Language dropdown (dynamically populated)
   - Tag dropdown (dynamically populated)
   - Search button

3. **Results Grid**
   - Card-based layout (responsive grid)
   - Each card shows:
     - Repository name
     - Description
     - Star/Fork counts
     - Language badge
     - Tags
     - External link

4. **Pagination**
   - Previous/Next buttons
   - Page indicator

### State Management

```typescript
const [username, setUsername] = useState('qdriven')
const [repos, setRepos] = useState<StarredRepo[]>([])
const [languages, setLanguages] = useState<Record<string, number>>({})
const [tags, setTags] = useState<Record<string, number>>({})
const [loading, setLoading] = useState(false)
const [collecting, setCollecting] = useState(false)
const [selectedLanguage, setSelectedLanguage] = useState<string>('')
const [selectedTag, setSelectedTag] = useState<string>('')
const [minStars, setMinStars] = useState<string>('')
const [maxStars, setMaxStars] = useState<string>('')
```

### API Client

```typescript
export const api = {
  async fetchStarredRepos(username: string),
  async collectStarredRepos(username: string),
  async searchStarredRepos(params: SearchParams),
  async getLanguages(username: string),
  async getTags(username: string),
}
```

## Scheduled Collection

### Cron Job Implementation

```go
scheduler := cron.New()
scheduler.MustAdd("collect_starred_repos", "0 0 * * *", func() {
    // 1. Query collection_configs collection
    // 2. For each enabled config:
    //    - Fetch starred repos
    //    - Save to database
    //    - Update last_collected timestamp
})
scheduler.Start()
```

### GitHub Actions Workflow

**Triggers**:
- Scheduled: Daily at midnight UTC
- Manual: workflow_dispatch

**Steps**:
1. Checkout repository
2. Set up Go environment
3. Build backend
4. Start PocketBase server
5. Run collection script
6. Export data to JSON
7. Commit changes to repository

## Build & Deployment

### Build Script (`build.sh`)

1. **Backend Build**:
   ```bash
   cd backend
   go mod download
   go build -o github-collector .
   ```

2. **Frontend Build**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

### Docker Deployment

**Backend Dockerfile**:
- Multi-stage build (builder + production)
- Alpine-based for minimal size
- Includes migrations
- Exposes port 8090

**Frontend Dockerfile**:
- Multi-stage build
- Standalone output mode
- Static file serving
- Exposes port 3000

### Docker Compose (Optional)

```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8090:8090"
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - ./backend/pb_data:/app/pb_data
  
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8090
    depends_on:
      - backend
```

## Security Considerations

1. **API Security**:
   - Currently no authentication (can be added)
   - Rate limiting via GitHub token
   - Input validation

2. **Data Security**:
   - SQLite database (file-based)
   - No sensitive data stored
   - Regular backups recommended

3. **Environment Variables**:
   - GITHUB_TOKEN for API access
   - NEXT_PUBLIC_API_URL for frontend
   - Never commit secrets to repository

## Performance Optimizations

1. **Backend**:
   - Batch inserts for collection
   - Indexed fields (github_user, repo_id, star_num, language)
   - Pagination for search results
   - Efficient filter expressions

2. **Frontend**:
   - Lazy loading components
   - Memoized callbacks
   - Optimized re-renders
   - Responsive grid layout

3. **API**:
   - Connection pooling
   - Request caching
   - Pagination support

## Testing Strategy

### Backend Tests
```bash
cd backend
go test -v ./...
```

### Frontend Tests
```bash
cd frontend
npm run lint        # ESLint
npm run type-check  # TypeScript
npm test            # Jest (if configured)
```

## Monitoring & Logging

### Backend Logging
```go
app.Logger().Info("Collecting starred repos", "username", username)
app.Logger().Error("Failed to fetch repos", "error", err)
```

### Frontend Logging
- Console logging for development
- Error boundary for production
- Network error handling

## Future Enhancements

1. **Authentication**: Add user authentication for private collections
2. **Real-time Updates**: WebSocket support for live updates
3. **Analytics**: Track popular repositories, trends
4. **Export Options**: CSV, JSON export functionality
5. **Comparison**: Compare starred repos between users
6. **Recommendations**: ML-based repository recommendations
7. **Mobile App**: React Native mobile application
8. **GraphQL**: Alternative API with GraphQL

## Known Limitations

1. **GitHub API Rate Limits**: 
   - 60 requests/hour without token
   - 5000 requests/hour with token

2. **Pagination**: 
   - Currently fetches all pages
   - May be slow for users with many starred repos

3. **Search Performance**:
   - SQLite may be slow with large datasets
   - Consider PostgreSQL for production

4. **No Real-time Updates**:
   - Requires manual refresh
   - Scheduled updates only

## Troubleshooting

### Common Issues

1. **PocketBase won't start**:
   - Check if port 8090 is available
   - Verify pb_data directory permissions

2. **GitHub API errors**:
   - Verify GITHUB_TOKEN is set
   - Check rate limit status
   - Validate username exists

3. **Frontend can't connect**:
   - Verify NEXT_PUBLIC_API_URL
   - Check CORS settings
   - Ensure backend is running

4. **Database errors**:
   - Check pb_data directory
   - Verify migrations ran
   - Check database schema

## Conclusion

This implementation provides a robust, scalable solution for collecting and viewing GitHub starred repositories. The architecture separates concerns cleanly, uses modern best practices, and can be extended for additional features.

For API usage examples and detailed endpoint documentation, see [API.md](./API.md).
