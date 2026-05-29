package adapter

import (
	"context"
	"fmt"
	"time"

	"github.com/innate/hub/internal/model"
)

// Registry holds all registered adapters keyed by source type.
type Registry struct {
	adapters map[string]Adapter
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{
		adapters: make(map[string]Adapter),
	}
}

// Register adds an adapter to the registry.
func (r *Registry) Register(a Adapter) {
	r.adapters[a.Name()] = a
}

// Get retrieves an adapter by its source type name.
func (r *Registry) Get(sourceType string) (Adapter, bool) {
	a, ok := r.adapters[sourceType]
	return a, ok
}

// Pull selects the appropriate adapter and pulls the feed.
func (r *Registry) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*Result, error) {
	sourceType := feed.SourceType
	if sourceType == "" {
		sourceType = "rss" // default backward compatibility
	}

	a, ok := r.adapters[sourceType]
	if !ok {
		return nil, fmt.Errorf("unknown source type: %s", sourceType)
	}

	return a.Pull(ctx, feed, timeout)
}

// SourceTypes returns all registered adapter names.
func (r *Registry) SourceTypes() []string {
	types := make([]string, 0, len(r.adapters))
	for t := range r.adapters {
		types = append(types, t)
	}
	return types
}
