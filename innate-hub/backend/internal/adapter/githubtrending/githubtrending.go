package githubtrending

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/innate/hub/internal/adapter"
	"github.com/innate/hub/internal/model"
	"github.com/innate/hub/internal/trending/pkg/github"
	"github.com/innate/hub/internal/trending/service"
	"github.com/innate/hub/internal/trending/store"
)

// Adapter pulls GitHub Trending repos and returns them as feed items.
type Adapter struct {
	svc *service.GitHubService
}

// New creates a GitHub Trending adapter.
func New(token, apiURL string, st *store.TrendingStore) *Adapter {
	client := github.NewClient(token, apiURL)
	svc := service.NewGitHubService(client, st)
	return &Adapter{svc: &svc}
}

func (a *Adapter) Name() string {
	return "githubtrending"
}

func (a *Adapter) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*adapter.Result, error) {
	// Parse config from feed.Link: "daily" or "daily:go" (period:language)
	period, language := parseFeedLink(feed.Link)

	repos, _, err := (*a.svc).GetTrending(ctx, period, language, 100, 0)
	if err != nil {
		return nil, fmt.Errorf("get trending: %w", err)
	}

	items := make([]model.Item, 0, len(repos))
	now := time.Now().Unix()

	for _, repo := range repos {
		meta := map[string]any{
			"stars":        repo.Stars,
			"stars_today":  repo.StarsToday,
			"forks":        repo.Forks,
			"language":     repo.Language,
			"period":       repo.Period,
			"contributors": repo.Contributors,
		}
		metaJSON, _ := json.Marshal(meta)

		guid := fmt.Sprintf("githubtrending:%s:%s", repo.Period, repo.FullName)
		content := fmt.Sprintf("⭐ %d (+%d today) | 🍴 %d | %s\n%s",
			repo.Stars, repo.StarsToday, repo.Forks, repo.Language, repo.Description)

		items = append(items, model.Item{
			GUID:    guid,
			Title:   repo.FullName,
			Link:    repo.URL,
			Content: content + "\n" + string(metaJSON),
			PubDate: now,
		})
	}

	return &adapter.Result{
		Items:       items,
		SiteURL:     "https://github.com/trending",
		NotModified: false,
		HTTPStatus:  200,
	}, nil
}

func parseFeedLink(link string) (period, language string) {
	parts := strings.SplitN(link, ":", 2)
	period = strings.TrimSpace(parts[0])
	if period == "" {
		period = "daily"
	}
	if len(parts) > 1 {
		language = strings.TrimSpace(parts[1])
	}
	return
}
