package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/innate/hub/internal/trending/model"
	"github.com/innate/hub/internal/trending/pkg/producthunt"
	"github.com/innate/hub/internal/trending/store"
)

type productHuntService struct {
	phClient *producthunt.Client
	store    *store.TrendingStore
}

// NewProductHuntService creates a ProductHuntService with explicit dependencies.
func NewProductHuntService(phClient *producthunt.Client, st *store.TrendingStore) ProductHuntService {
	return &productHuntService{
		phClient: phClient,
		store:    st,
	}
}

// FetchTrending fetches products from Product Hunt and stores them.
func (s *productHuntService) FetchTrending(ctx context.Context, day string, limit int) ([]model.ProductHunt, error) {
	slog.Info("fetching Product Hunt trending", "day", day, "limit", limit)

	products, err := s.phClient.GetTrending(ctx, day, limit)
	if err != nil {
		return nil, fmt.Errorf("fetching products from Product Hunt: %w", err)
	}

	now := time.Now()
	var records []model.ProductHunt
	for _, product := range products {
		makersJSON, err := json.Marshal(product.Makers)
		if err != nil {
			slog.Warn("failed to marshal makers", "product", product.Name, "error", err)
			makersJSON = []byte("[]")
		}

		topicsJSON, err := json.Marshal(product.Topics)
		if err != nil {
			slog.Warn("failed to marshal topics", "product", product.Name, "error", err)
			topicsJSON = []byte("[]")
		}

		dayTime, err := time.Parse("2006-01-02", product.Day)
		if err != nil {
			slog.Warn("failed to parse day, using current time", "day", product.Day, "error", err)
			dayTime = now
		}

		records = append(records, model.ProductHunt{
			ProductID:     product.ID,
			Name:          product.Name,
			Tagline:       product.Tagline,
			Description:   product.Description,
			URL:           product.URL,
			Thumbnail:     product.Thumbnail,
			VotesCount:    product.VotesCount,
			CommentsCount: product.CommentsCount,
			Makers:        string(makersJSON),
			Topics:        string(topicsJSON),
			Day:           dayTime,
			Featured:      product.Featured,
			FetchedAt:     now,
		})
	}

	if len(records) > 0 {
		if err := s.store.UpsertProductHunt(ctx, records); err != nil {
			return nil, fmt.Errorf("upserting product hunt products: %w", err)
		}
		slog.Info("stored Product Hunt products", "count", len(records))
	}

	return records, nil
}

// GetTrending queries products with optional day filter, pagination.
func (s *productHuntService) GetTrending(ctx context.Context, day string, limit, offset int) ([]model.ProductHunt, int64, error) {
	return s.store.GetProductHunt(ctx, day, limit, offset)
}

// GetCategories returns distinct topic names from all stored products.
func (s *productHuntService) GetCategories(ctx context.Context) ([]string, error) {
	return s.store.GetCategories(ctx)
}
