package producthunt

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/innate/hub/internal/adapter"
	"github.com/innate/hub/internal/model"
	"github.com/innate/hub/internal/trending/pkg/producthunt"
	"github.com/innate/hub/internal/trending/service"
	"github.com/innate/hub/internal/trending/store"
)

// Adapter pulls Product Hunt posts and returns them as feed items.
type Adapter struct {
	svc *service.ProductHuntService
}

// New creates a Product Hunt adapter.
func New(token, apiURL string, st *store.TrendingStore) *Adapter {
	client := producthunt.NewClient(token, apiURL)
	svc := service.NewProductHuntService(client, st)
	return &Adapter{svc: &svc}
}

func (a *Adapter) Name() string {
	return "producthunt"
}

func (a *Adapter) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*adapter.Result, error) {
	day := strings.TrimSpace(feed.Link)
	if day == "" {
		day = time.Now().Format("2006-01-02")
	}

	products, _, err := (*a.svc).GetTrending(ctx, day, 100, 0)
	if err != nil {
		return nil, fmt.Errorf("get producthunt: %w", err)
	}

	items := make([]model.Item, 0, len(products))
	now := time.Now().Unix()

	for _, p := range products {
		meta := map[string]any{
			"votes":    p.VotesCount,
			"comments": p.CommentsCount,
			"featured": p.Featured,
			"day":      p.Day.Format("2006-01-02"),
		}
		metaJSON, _ := json.Marshal(meta)

		guid := fmt.Sprintf("producthunt:%s:%s", p.Day.Format("2006-01-02"), p.ProductID)
		content := fmt.Sprintf("👍 %d | 💬 %d | %s\n%s",
			p.VotesCount, p.CommentsCount, p.Tagline, p.Description)

		items = append(items, model.Item{
			GUID:    guid,
			Title:   p.Name,
			Link:    p.URL,
			Content: content + "\n" + string(metaJSON),
			PubDate: now,
		})
	}

	return &adapter.Result{
		Items:       items,
		SiteURL:     "https://www.producthunt.com",
		NotModified: false,
		HTTPStatus:  200,
	}, nil
}
