package service

import (
	"context"

	"github.com/innate/hub/internal/trending/model"
)

// GitHubService defines the contract for GitHub-related operations.
type GitHubService interface {
	FetchTrending(ctx context.Context, period, language string, limit int) ([]model.GitHubTrending, error)
	FetchUserStarred(ctx context.Context, username string, limit int) ([]model.GitHubStarred, error)
	GetTrending(ctx context.Context, period, language string, limit, offset int) ([]model.GitHubTrending, int64, error)
	GetStarred(ctx context.Context, username, language string, limit, offset int, sort string) ([]model.GitHubStarred, int64, error)
	GetLanguages(ctx context.Context) ([]string, error)
	GetUserLanguages(ctx context.Context, username string) (map[string]int, error)
}

// ProductHuntService defines the contract for Product Hunt operations.
type ProductHuntService interface {
	FetchTrending(ctx context.Context, day string, limit int) ([]model.ProductHunt, error)
	GetTrending(ctx context.Context, day string, limit, offset int) ([]model.ProductHunt, int64, error)
	GetCategories(ctx context.Context) ([]string, error)
}
