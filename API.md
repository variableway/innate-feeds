# GitHub Starred Repositories API Documentation

Base URL: `http://localhost:8090`

## Overview

This API provides endpoints to fetch, collect, and search GitHub starred repositories for any user.

## Authentication

Currently, the API does not require authentication for read operations. However, it's recommended to set a `GITHUB_TOKEN` environment variable for higher rate limits when fetching data from GitHub.

## Endpoints

### 1. Fetch GitHub Starred Repositories

Fetch starred repositories directly from GitHub API without saving to database.

**Endpoint:** `GET /api/github/starred/:username`

**Parameters:**
- `username` (path): GitHub username

**Response:**
```json
{
  "username": "qdriven",
  "count": 150,
  "repos": [
    {
      "id": 123456789,
      "name": "example-repo",
      "full_name": "owner/example-repo",
      "description": "An example repository",
      "html_url": "https://github.com/owner/example-repo",
      "stargazers_count": 5000,
      "language": "TypeScript",
      "forks_count": 200,
      "topics": ["javascript", "typescript", "nodejs"],
      "owner": {
        "login": "owner",
        "id": 123456
      },
      "created_at": "2020-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "pushed_at": "2024-01-15T00:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Successfully fetched repositories
- `400 Bad Request`: Username is missing or invalid
- `500 Internal Server Error`: Failed to fetch from GitHub API

---

### 2. Collect Starred Repositories

Fetch and save starred repositories to the database.

**Endpoint:** `POST /api/github/collect/:username`

**Parameters:**
- `username` (path): GitHub username

**Response:**
```json
{
  "username": "qdriven",
  "fetched": 150,
  "saved": 150,
  "message": "Starred repositories collected successfully"
}
```

**Status Codes:**
- `200 OK`: Successfully collected repositories
- `400 Bad Request`: Username is missing or invalid
- `500 Internal Server Error`: Failed to fetch or save repositories

---

### 3. Search Starred Repositories

Search starred repositories with filters.

**Endpoint:** `GET /api/starred/search`

**Query Parameters:**
- `github_user` (required): GitHub username
- `min_stars` (optional): Minimum number of stars
- `max_stars` (optional): Maximum number of stars
- `language` (optional): Programming language filter
- `tag` (optional): Topic/tag filter (partial match)
- `page` (optional): Page number (default: 1)
- `perPage` (optional): Items per page (default: 30)

**Example Request:**
```
GET /api/starred/search?github_user=qdriven&min_stars=100&max_stars=10000&language=TypeScript&page=1&perPage=30
```

**Response:**
```json
{
  "page": 1,
  "perPage": 30,
  "items": [
    {
      "id": "RECORD_ID",
      "github_user": "qdriven",
      "repo_id": 123456789,
      "repo_name": "example-repo",
      "full_name": "owner/example-repo",
      "description": "An example repository",
      "html_url": "https://github.com/owner/example-repo",
      "star_num": 5000,
      "language": "TypeScript",
      "fork_num": 200,
      "tags": "javascript,typescript,nodejs",
      "created_at": "2020-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "pushed_at": "2024-01-15T00:00:00Z",
      "collected_at": "2024-01-20T12:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved repositories
- `400 Bad Request`: Missing required parameters or invalid query
- `500 Internal Server Error`: Database error

---

### 4. Get Available Languages

Get all programming languages and their counts for a user.

**Endpoint:** `GET /api/starred/languages/:username`

**Parameters:**
- `username` (path): GitHub username

**Response:**
```json
{
  "languages": {
    "TypeScript": 45,
    "JavaScript": 38,
    "Python": 25,
    "Go": 15,
    "Rust": 12
  }
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved languages
- `400 Bad Request`: Username is missing
- `500 Internal Server Error`: Database error

---

### 5. Get Available Tags

Get all tags/topics and their counts for a user.

**Endpoint:** `GET /api/starred/tags/:username`

**Parameters:**
- `username` (path): GitHub username

**Response:**
```json
{
  "tags": {
    "nodejs": 30,
    "react": 25,
    "typescript": 20,
    "api": 18,
    "cli": 15
  }
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved tags
- `400 Bad Request`: Username is missing
- `500 Internal Server Error`: Database error

---

## Data Models

### StarredRepo

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique record ID |
| github_user | string | GitHub username |
| repo_id | number | GitHub repository ID |
| repo_name | string | Repository name |
| full_name | string | Full repository name (owner/repo) |
| description | string | Repository description |
| html_url | string | Repository URL |
| star_num | number | Number of stars |
| language | string | Primary programming language |
| fork_num | number | Number of forks |
| tags | string | Comma-separated list of topics |
| created_at | timestamp | Repository creation date |
| updated_at | timestamp | Repository last update date |
| pushed_at | timestamp | Repository last push date |
| collected_at | timestamp | When this data was collected |

### CollectionConfig

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique record ID |
| github_user | string | GitHub username |
| enabled | boolean | Whether scheduled collection is enabled |
| schedule | string | Cron schedule expression |
| last_collected | timestamp | Last collection timestamp |

---

## Error Responses

All error responses follow this format:

```json
{
  "code": 400,
  "message": "Error description",
  "data": {}
}
```

---

## Rate Limits

- GitHub API has rate limits: 60 requests/hour without authentication, 5000 requests/hour with authentication
- Set `GITHUB_TOKEN` environment variable for higher rate limits
- The API automatically paginates through all starred repositories

---

## Scheduled Collection

The system includes a built-in scheduler that runs daily at midnight UTC to collect starred repositories for all users configured in the `collection_configs` table.

To enable scheduled collection for a user:
1. Create a record in the `collection_configs` collection
2. Set `enabled` to `true`
3. Optionally customize the `schedule` field (cron format)

---

## Examples

### cURL Examples

```bash
# Fetch starred repos
curl http://localhost:8090/api/github/starred/qdriven

# Collect starred repos
curl -X POST http://localhost:8090/api/github/collect/qdriven

# Search with filters
curl "http://localhost:8090/api/starred/search?github_user=qdriven&min_stars=100&language=TypeScript"

# Get languages
curl http://localhost:8090/api/starred/languages/qdriven

# Get tags
curl http://localhost:8090/api/starred/tags/qdriven
```

### JavaScript/TypeScript Examples

```typescript
import axios from 'axios';

const API_URL = 'http://localhost:8090';

// Fetch starred repos
const repos = await axios.get(`${API_URL}/api/github/starred/qdriven`);

// Collect starred repos
await axios.post(`${API_URL}/api/github/collect/qdriven`);

// Search with filters
const results = await axios.get(`${API_URL}/api/starred/search`, {
  params: {
    github_user: 'qdriven',
    min_stars: 100,
    language: 'TypeScript',
    page: 1,
    perPage: 30
  }
});

// Get languages
const languages = await axios.get(`${API_URL}/api/starred/languages/qdriven`);

// Get tags
const tags = await axios.get(`${API_URL}/api/starred/tags/qdriven`);
```

---

## Deployment Notes

1. Set `GITHUB_TOKEN` environment variable for production
2. Configure `NEXT_PUBLIC_API_URL` for frontend
3. PocketBase data is stored in `backend/pb_data` directory
4. Backups are recommended for the `pb_data` directory
5. For production, consider adding authentication and rate limiting
