package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/innate/hub/internal/trending/model"
	"github.com/innate/hub/internal/trending/pkg/github"
	"github.com/innate/hub/internal/trending/store"
)

type githubService struct {
	ghClient *github.Client
	store    *store.TrendingStore
}

// NewGitHubService creates a GitHubService with explicit dependencies.
func NewGitHubService(ghClient *github.Client, st *store.TrendingStore) GitHubService {
	return &githubService{
		ghClient: ghClient,
		store:    st,
	}
}

// FetchTrending fetches trending repos from GitHub and stores them.
func (s *githubService) FetchTrending(ctx context.Context, period, language string, limit int) ([]model.GitHubTrending, error) {
	slog.Info("fetching GitHub trending", "period", period, "language", language, "limit", limit)

	repos, err := s.ghClient.GetTrending(ctx, period, language, limit)
	if err != nil {
		return nil, fmt.Errorf("fetching trending from GitHub: %w", err)
	}

	now := time.Now()
	var records []model.GitHubTrending
	for _, repo := range repos {
		records = append(records, model.GitHubTrending{
			RepoName:    repo.Name,
			Owner:       repo.Owner,
			FullName:    repo.FullName,
			Description: repo.Description,
			Language:    repo.Language,
			Stars:       repo.Stars,
			StarsToday:  repo.StarsToday,
			Forks:       repo.Forks,
			Period:      period,
			FetchedAt:   now,
			URL:         repo.URL,
		})
	}

	if len(records) > 0 {
		if err := s.store.UpsertTrending(ctx, records); err != nil {
			return nil, fmt.Errorf("upserting trending repos: %w", err)
		}
		slog.Info("stored GitHub trending repos", "count", len(records))
	}

	return records, nil
}

// FetchUserStarred fetches starred repos for a user and stores them.
func (s *githubService) FetchUserStarred(ctx context.Context, username string, limit int) ([]model.GitHubStarred, error) {
	slog.Info("fetching GitHub starred repos", "username", username, "limit", limit)

	repos, err := s.ghClient.GetUserStarred(ctx, username, limit)
	if err != nil {
		return nil, fmt.Errorf("fetching starred repos for %s: %w", username, err)
	}

	now := time.Now()
	var records []model.GitHubStarred
	for _, repo := range repos {
		topicsJSON, err := json.Marshal(repo.Topics)
		if err != nil {
			slog.Warn("failed to marshal topics", "repo", repo.FullName, "error", err)
			topicsJSON = []byte("[]")
		}

		records = append(records, model.GitHubStarred{
			RepoName:    repo.Name,
			Owner:       repo.Owner.Login,
			FullName:    repo.FullName,
			Username:    username,
			Description: repo.Description,
			Language:    repo.Language,
			Stars:       repo.Stars,
			Forks:       repo.Forks,
			StarredAt:   repo.StarredAt,
			Topics:      string(topicsJSON),
			URL:         repo.HTMLURL,
			Private:     repo.Private,
			FetchedAt:   now,
		})
	}

	if len(records) > 0 {
		if err := s.store.UpsertStarred(ctx, username, records); err != nil {
			return nil, fmt.Errorf("upserting starred repos: %w", err)
		}
		slog.Info("stored GitHub starred repos", "username", username, "count", len(records))
	}

	return records, nil
}

// GetTrending queries the database with optional period/language filters, pagination.
func (s *githubService) GetTrending(ctx context.Context, period, language string, limit, offset int) ([]model.GitHubTrending, int64, error) {
	return s.store.GetTrending(ctx, period, language, limit, offset)
}

// GetStarred queries starred repos for a user with optional language filter and sorting.
func (s *githubService) GetStarred(ctx context.Context, username, language string, limit, offset int, sort string) ([]model.GitHubStarred, int64, error) {
	return s.store.GetStarred(ctx, username, language, limit, offset, sort)
}

// GetLanguages returns distinct languages from the trending table.
func (s *githubService) GetLanguages(ctx context.Context) ([]string, error) {
	return s.store.GetLanguages(ctx)
}

// GetUserLanguages returns language breakdown (map[string]int) for a user's starred repos.
func (s *githubService) GetUserLanguages(ctx context.Context, username string) (map[string]int, error) {
	return s.store.GetUserLanguages(ctx, username)
}
