# Adapter Specification

## Interface

```go
package adapter

import (
    "context"
    "time"
    "github.com/innate/hub/internal/model"
)

// Result is returned by an Adapter after pulling a feed.
type Result struct {
    Items           []model.Item
    SiteURL         string
    NotModified     bool
    HTTPStatus      int
    ETag            string
    LastModified    string
    CacheControl    string
    ExpiresAt       int64
    RetryAfterUntil int64
}

// Adapter is the unified interface for all feed sources.
type Adapter interface {
    Name() string
    Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*Result, error)
}
```

## Registry

```go
type Registry struct { /* ... */ }

func NewRegistry() *Registry
func (r *Registry) Register(a Adapter)
func (r *Registry) Get(sourceType string) (Adapter, bool)
func (r *Registry) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*Result, error)
```

## Built-in Adapters

### RSS Adapter
- **Package**: `internal/adapter/rss`
- **Name**: `"rss"`
- **Pull**: HTTP GET with conditional headers, parses RSS/Atom via `gofeed`
- **Config**: `feed.Link` = RSS URL; `feed.Proxy` = optional proxy

### TrendRadar Adapter
- **Package**: `internal/adapter/trendradar`
- **Name**: `"trendradar"`
- **Pull**: Opens latest SQLite DB, queries `news_items`, maps to items
- **Config**: `feed.Link` = data directory path

## Adding a Custom Adapter

```go
package mysource

import (
    "context"
    "time"
    "github.com/innate/hub/internal/adapter"
    "github.com/innate/hub/internal/model"
)

type MyAdapter struct{}

func New() *MyAdapter { return &MyAdapter{} }

func (a *MyAdapter) Name() string { return "mysource" }

func (a *MyAdapter) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*adapter.Result, error) {
    // ... fetch data from your source ...
    return &adapter.Result{
        Items: []model.Item{
            {GUID: "...", Title: "...", Link: "...", Content: "...", PubDate: time.Now().Unix()},
        },
    }, nil
}
```

Register in `cmd/hub/main.go`:
```go
reg.Register(mysource.New())
```
