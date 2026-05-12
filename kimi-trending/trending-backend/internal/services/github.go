package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"trending-backend/internal/config"
	"trending-backend/internal/db"
	"trending-backend/internal/models"
	"trending-backend/pkg/github"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type githubService struct {
	ghClient *github.Client
	db       *gorm.DB
}

// NewGitHubService creates a new GitHubService instance.
// Deprecated: Use NewGitHubService() for singleton or NewGitHubServiceWithClient() for DI.
func NewGitHubService(ghClient *github.Client, db *gorm.DB) GitHubService {
	return NewGitHubServiceWithClient(ghClient, db)
}

// FetchTrending fetches trending repos from GitHub and stores them.
func (s *githubService) FetchTrending(ctx context.Context, period, language string, limit int) ([]models.GitHubTrending, error) {
	slog.Info("fetching GitHub trending", "period", period, "language", language, "limit", limit)

	repos, err := s.ghClient.GetTrending(ctx, period, language, limit)
	if err != nil {
		return nil, fmt.Errorf("fetching trending from GitHub: %w", err)
	}

	now := time.Now()
	var records []models.GitHubTrending
	for _, repo := range repos {
		records = append(records, models.GitHubTrending{
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
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
			UpdateAll: true,
		}).CreateInBatches(records, 100).Error; err != nil {
			return nil, fmt.Errorf("upserting trending repos: %w", err)
		}
		slog.Info("stored GitHub trending repos", "count", len(records))
	}

	return records, nil
}

// FetchUserStarred fetches starred repos for a user and stores them.
func (s *githubService) FetchUserStarred(ctx context.Context, username string, limit int) ([]models.GitHubStarred, error) {
	slog.Info("fetching GitHub starred repos", "username", username, "limit", limit)

	repos, err := s.ghClient.GetUserStarred(ctx, username, limit)
	if err != nil {
		return nil, fmt.Errorf("fetching starred repos for %s: %w", username, err)
	}

	now := time.Now()
	var records []models.GitHubStarred
	for _, repo := range repos {
		topicsJSON, err := json.Marshal(repo.Topics)
		if err != nil {
			slog.Warn("failed to marshal topics", "repo", repo.FullName, "error", err)
			topicsJSON = []byte("[]")
		}

		records = append(records, models.GitHubStarred{
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
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
			UpdateAll: true,
		}).CreateInBatches(records, 100).Error; err != nil {
			return nil, fmt.Errorf("upserting starred repos: %w", err)
		}
		slog.Info("stored GitHub starred repos", "username", username, "count", len(records))
	}

	return records, nil
}

// GetTrending queries the database with optional period/language filters, pagination.
func (s *githubService) GetTrending(ctx context.Context, period, language string, limit, offset int) ([]models.GitHubTrending, int64, error) {
	var total int64
	var repos []models.GitHubTrending

	query := s.db.WithContext(ctx).Model(&models.GitHubTrending{})

	if period != "" {
		query = query.Where("period = ?", period)
	}
	if language != "" {
		query = query.Where("language = ?", language)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("counting trending repos: %w", err)
	}

	if limit <= 0 {
		limit = 30
	}

	if err := query.Order("stars_today DESC, stars DESC").Limit(limit).Offset(offset).Find(&repos).Error; err != nil {
		return nil, 0, fmt.Errorf("querying trending repos: %w", err)
	}

	return repos, total, nil
}

// GetStarred queries starred repos for a user with optional language filter and sorting.
func (s *githubService) GetStarred(ctx context.Context, username, language string, limit, offset int, sort string) ([]models.GitHubStarred, int64, error) {
	var total int64
	var repos []models.GitHubStarred

	query := s.db.WithContext(ctx).Model(&models.GitHubStarred{}).Where("username = ?", username)

	if language != "" {
		query = query.Where("language = ?", language)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("counting starred repos: %w", err)
	}

	if limit <= 0 {
		limit = 30
	}

	// Apply sorting
	orderClause := "starred_at DESC"
	switch sort {
	case "stars":
		orderClause = "stars DESC"
	case "starred_at":
		orderClause = "starred_at DESC"
	default:
		orderClause = "starred_at DESC"
	}

	if err := query.Order(orderClause).Limit(limit).Offset(offset).Find(&repos).Error; err != nil {
		return nil, 0, fmt.Errorf("querying starred repos: %w", err)
	}

	return repos, total, nil
}

// GetLanguages returns distinct languages from the trending table.
func (s *githubService) GetLanguages(ctx context.Context) ([]string, error) {
	var languages []string

	if err := s.db.WithContext(ctx).
		Model(&models.GitHubTrending{}).
		Where("language != ?", "").
		Distinct().
		Pluck("language", &languages).Error; err != nil {
		return nil, fmt.Errorf("fetching distinct languages: %w", err)
	}

	return languages, nil
}

// GetUserLanguages returns language breakdown (map[string]int) for a user's starred repos.
func (s *githubService) GetUserLanguages(ctx context.Context, username string) (map[string]int, error) {
	type result struct {
		Language string
		Count    int
	}

	var results []result
	if err := s.db.WithContext(ctx).
		Model(&models.GitHubStarred{}).
		Select("COALESCE(NULLIF(language, ''), 'Unknown') as language, COUNT(*) as count").
		Where("username = ?", username).
		Group("language").
		Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("fetching language breakdown: %w", err)
	}

	breakdown := make(map[string]int)
	for _, r := range results {
		breakdown[r.Language] = r.Count
	}

	return breakdown, nil
}

// NewGitHubService creates a new GitHubService using default config and DB.
func NewGitHubService() GitHubService {
	cfg := config.Get()
	client := github.NewClient(cfg.GitHubToken, cfg.GitHubAPIURL)
	return NewGitHubServiceWithClient(client, db.Get())
}

// NewGitHubServiceWithClient creates a GitHubService with explicit dependencies.
func NewGitHubServiceWithClient(ghClient *github.Client, database *gorm.DB) GitHubService {
	return &githubService{
		ghClient: ghClient,
		db:       database,
	}
}
