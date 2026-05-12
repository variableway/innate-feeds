package services

import (
	"context"

	"trending-backend/internal/models"
)

// GitHubService defines the contract for GitHub-related operations.
type GitHubService interface {
	FetchTrending(ctx context.Context, period, language string, limit int) ([]models.GitHubTrending, error)
	FetchUserStarred(ctx context.Context, username string, limit int) ([]models.GitHubStarred, error)
	GetTrending(ctx context.Context, period, language string, limit, offset int) ([]models.GitHubTrending, int64, error)
	GetStarred(ctx context.Context, username, language string, limit, offset int, sort string) ([]models.GitHubStarred, int64, error)
	GetLanguages(ctx context.Context) ([]string, error)
	GetUserLanguages(ctx context.Context, username string) (map[string]int, error)
}

// ProductHuntService defines the contract for Product Hunt operations.
type ProductHuntService interface {
	FetchTrending(ctx context.Context, day string, limit int) ([]models.ProductHunt, error)
	GetTrending(ctx context.Context, day string, limit, offset int) ([]models.ProductHunt, int64, error)
	GetCategories(ctx context.Context) ([]string, error)
}
