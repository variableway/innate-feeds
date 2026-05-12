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
	"trending-backend/pkg/producthunt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type productHuntService struct {
	phClient *producthunt.Client
	db       *gorm.DB
}

// NewProductHuntService creates a new ProductHuntService instance.
// Deprecated: Use NewProductHuntService() for singleton or NewProductHuntServiceWithClient() for DI.
func NewProductHuntService(phClient *producthunt.Client, db *gorm.DB) ProductHuntService {
	return NewProductHuntServiceWithClient(phClient, db)
}

// FetchTrending fetches products from Product Hunt and stores them.
func (s *productHuntService) FetchTrending(ctx context.Context, day string, limit int) ([]models.ProductHunt, error) {
	slog.Info("fetching Product Hunt trending", "day", day, "limit", limit)

	products, err := s.phClient.GetTrending(ctx, day, limit)
	if err != nil {
		return nil, fmt.Errorf("fetching products from Product Hunt: %w", err)
	}

	now := time.Now()
	var records []models.ProductHunt
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

		records = append(records, models.ProductHunt{
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
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
			UpdateAll: true,
		}).CreateInBatches(records, 100).Error; err != nil {
			return nil, fmt.Errorf("upserting product hunt products: %w", err)
		}
		slog.Info("stored Product Hunt products", "count", len(records))
	}

	return records, nil
}

// GetTrending queries products with optional day filter, pagination.
func (s *productHuntService) GetTrending(ctx context.Context, day string, limit, offset int) ([]models.ProductHunt, int64, error) {
	var total int64
	var products []models.ProductHunt

	query := s.db.WithContext(ctx).Model(&models.ProductHunt{})

	if day != "" {
		dayTime, err := time.Parse("2006-01-02", day)
		if err != nil {
			return nil, 0, fmt.Errorf("parsing day filter: %w", err)
		}
		query = query.Where("day = ?", dayTime)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("counting product hunt products: %w", err)
	}

	if limit <= 0 {
		limit = 30
	}

	if err := query.Order("votes_count DESC").Limit(limit).Offset(offset).Find(&products).Error; err != nil {
		return nil, 0, fmt.Errorf("querying product hunt products: %w", err)
	}

	return products, total, nil
}

// GetCategories returns distinct topic names from all stored products.
// Parses the Topics JSON string field and collects unique values.
func (s *productHuntService) GetCategories(ctx context.Context) ([]string, error) {
	var products []models.ProductHunt

	if err := s.db.WithContext(ctx).
		Select("id", "topics").
		Where("topics != ?", "").
		Find(&products).Error; err != nil {
		return nil, fmt.Errorf("fetching products for category extraction: %w", err)
	}

	seen := make(map[string]struct{})
	var categories []string

	for _, product := range products {
		var topics []struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal([]byte(product.Topics), &topics); err != nil {
			slog.Warn("failed to unmarshal topics for product", "product_id", product.ProductID, "error", err)
			continue
		}

		for _, topic := range topics {
			if topic.Name == "" {
				continue
			}
			if _, ok := seen[topic.Name]; !ok {
				seen[topic.Name] = struct{}{}
				categories = append(categories, topic.Name)
			}
		}
	}

	return categories, nil
}

// NewProductHuntService creates a new ProductHuntService using default config and DB.
func NewProductHuntService() ProductHuntService {
	cfg := config.Get()
	client := producthunt.NewClient(cfg.ProductHuntToken, cfg.ProductHuntAPIURL)
	return NewProductHuntServiceWithClient(client, db.Get())
}

// NewProductHuntServiceWithClient creates a ProductHuntService with explicit dependencies.
func NewProductHuntServiceWithClient(phClient *producthunt.Client, database *gorm.DB) ProductHuntService {
	return &productHuntService{
		phClient: phClient,
		db:       database,
	}
}
