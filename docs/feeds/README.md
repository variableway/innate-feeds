# Feeds Module

The feeds module manages all feed sources inside Innate Hub. It is built on top of Fusion's core feed system with an added **Adapter** abstraction.

## Concepts

### Feed
A feed is a source of articles. In Innate Hub, a feed can be:
- An **RSS/Atom** URL fetched over HTTP
- A **TrendRadar** SQLite database scanned locally
- Any future source implementing the `Adapter` interface

### Item
An item is a single article/post. All items land in the same `items` table regardless of source type.

### Adapter
An adapter is a Go type that implements `adapter.Adapter`:
```go
type Adapter interface {
    Name() string
    Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*Result, error)
}
```

Adapters are registered at startup in `cmd/hub/main.go`.

## Supported Source Types

| Type | Adapter | Data Source |
|------|---------|-------------|
| `rss` | `rss.Adapter` | HTTP RSS/Atom feeds |
| `trendradar` | `trendradar.Adapter` | Local SQLite (`output/news/*.db`) |

## Adding a New Feed Source

1. Create a new package under `internal/adapter/<yoursource>/`
2. Implement `adapter.Adapter`
3. Register it in `cmd/hub/main.go`:
   ```go
   reg.Register(yoursource.New(...))
   ```
4. Create feeds via API with `"source_type": "yoursource"`

The rest of the system (pull scheduler, item storage, frontend) works unchanged.
