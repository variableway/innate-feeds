// Package rss provides an adapter for standard RSS/Atom feeds.
//
// It wraps Fusion's original FetchAndParse logic so it conforms to the
// unified adapter.Adapter interface. Any feed with source_type="rss"
// (or empty, for backward compatibility) is handled by this adapter.
package rss

import (
	"context"
	"time"

	"github.com/innate/hub/internal/adapter"
	"github.com/innate/hub/internal/model"
)

type RSSAdapter struct {
	allowPrivateFeeds bool
}

func New(allowPrivateFeeds bool) *RSSAdapter {
	return &RSSAdapter{allowPrivateFeeds: allowPrivateFeeds}
}

func (a *RSSAdapter) Name() string {
	return "rss"
}

func (a *RSSAdapter) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*adapter.Result, error) {
	fetchResult, err := FetchAndParse(ctx, feed, timeout, a.allowPrivateFeeds)
	if err != nil {
		return nil, err
	}

	items := make([]model.Item, 0, len(fetchResult.Items))
	for _, pi := range fetchResult.Items {
		items = append(items, model.Item{
			GUID:    pi.GUID,
			Title:   pi.Title,
			Link:    pi.Link,
			Content: pi.Content,
			PubDate: pi.PubDate,
		})
	}

	return &adapter.Result{
		Items:           items,
		SiteURL:         fetchResult.SiteURL,
		NotModified:     fetchResult.NotModified,
		HTTPStatus:      fetchResult.HTTPStatus,
		ETag:            fetchResult.ETag,
		LastModified:    fetchResult.LastModified,
		CacheControl:    fetchResult.CacheControl,
		ExpiresAt:       fetchResult.ExpiresAt,
		RetryAfterUntil: fetchResult.RetryAfterUntil,
	}, nil
}
