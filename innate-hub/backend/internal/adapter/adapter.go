// Package adapter defines the abstract interface for feed sources.
//
// An Adapter represents a unified way to pull content from any feed system,
// whether it's a standard RSS/Atom feed, a local SQLite database (TrendRadar),
// or any other external source. The registry allows dynamic registration of
// adapters so new feed systems can be plugged in without modifying core logic.
package adapter

import (
	"context"
	"time"

	"github.com/innate/hub/internal/model"
)

// Result is returned by an Adapter after pulling a feed.
type Result struct {
	// Items contains the articles/posts/items fetched from the source.
	Items []model.Item
	// SiteURL is the canonical website URL (for auto-fill).
	SiteURL string
	// NotModified is true when the source reports no new content.
	NotModified bool
	// HTTPStatus is the raw HTTP status (for RSS adapters; 0 for local adapters).
	HTTPStatus int
	// ETag is the HTTP ETag validator (for RSS adapters).
	ETag string
	// LastModified is the HTTP Last-Modified validator (for RSS adapters).
	LastModified string
	// CacheControl is the raw Cache-Control header (for RSS adapters).
	CacheControl string
	// ExpiresAt is parsed from Expires header (for RSS adapters).
	ExpiresAt int64
	// RetryAfterUntil blocks fetches before this Unix time (for RSS adapters).
	RetryAfterUntil int64
}

// Adapter is the unified interface for all feed sources.
type Adapter interface {
	// Name returns the adapter identifier used in the registry (e.g. "rss", "trendradar").
	Name() string
	// Pull fetches content for the given feed and returns a Result.
	// The feed.Link field may carry adapter-specific configuration.
	Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*Result, error)
}

// DiscoveryResult is returned by adapters that support automatic feed discovery.
type DiscoveryResult struct {
	Name    string
	Link    string
	SiteURL string
}

// DiscoveryAdapter is an optional interface for adapters that can auto-discover feeds.
type DiscoveryAdapter interface {
	Adapter
	// Discover scans the source configuration and returns a list of available feeds.
	Discover(ctx context.Context, configLink string) ([]DiscoveryResult, error)
}
