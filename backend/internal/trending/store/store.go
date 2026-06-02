package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/innate/hub/internal/trending/model"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TrendingStore provides data access for trending-related tables.
type TrendingStore struct {
	db *gorm.DB
}

// New creates a TrendingStore from an existing *sql.DB.
func New(db *sql.DB, driver string) (*TrendingStore, error) {
	var dialector gorm.Dialector
	switch driver {
	case "postgres":
		dialector = postgres.New(postgres.Config{Conn: db})
	default:
		dialector = sqlite.New(sqlite.Config{Conn: db})
	}

	gormDB, err := gorm.Open(dialector, &gorm.Config{
		Logger: nil, // rely on application-level slog
	})
	if err != nil {
		return nil, fmt.Errorf("open gorm: %w", err)
	}

	return &TrendingStore{db: gormDB}, nil
}

// AutoMigrate creates or updates trending tables.
func (s *TrendingStore) AutoMigrate() error {
	return s.db.AutoMigrate(
		&model.GitHubTrending{},
		&model.GitHubStarred{},
		&model.ProductHunt{},
	)
}

// --- GitHub Trending ---

func (s *TrendingStore) UpsertTrending(ctx context.Context, records []model.GitHubTrending) error {
	if len(records) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		UpdateAll: true,
	}).CreateInBatches(records, 100).Error
}

func (s *TrendingStore) GetTrending(ctx context.Context, period, language string, limit, offset int) ([]model.GitHubTrending, int64, error) {
	var total int64
	var repos []model.GitHubTrending

	query := s.db.WithContext(ctx).Model(&model.GitHubTrending{})
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

func (s *TrendingStore) GetLanguages(ctx context.Context) ([]string, error) {
	var languages []string
	if err := s.db.WithContext(ctx).
		Model(&model.GitHubTrending{}).
		Where("language != ?", "").
		Distinct().
		Pluck("language", &languages).Error; err != nil {
		return nil, fmt.Errorf("fetching distinct languages: %w", err)
	}
	return languages, nil
}

// --- GitHub Starred ---

func (s *TrendingStore) UpsertStarred(ctx context.Context, username string, records []model.GitHubStarred) error {
	if len(records) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		UpdateAll: true,
	}).CreateInBatches(records, 100).Error
}

func (s *TrendingStore) GetStarred(ctx context.Context, username, language string, limit, offset int, sort string) ([]model.GitHubStarred, int64, error) {
	var total int64
	var repos []model.GitHubStarred

	query := s.db.WithContext(ctx).Model(&model.GitHubStarred{}).Where("username = ?", username)
	if language != "" {
		query = query.Where("language = ?", language)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("counting starred repos: %w", err)
	}

	if limit <= 0 {
		limit = 30
	}

	orderClause := "starred_at DESC"
	switch sort {
	case "stars":
		orderClause = "stars DESC"
	case "starred_at":
		orderClause = "starred_at DESC"
	}

	if err := query.Order(orderClause).Limit(limit).Offset(offset).Find(&repos).Error; err != nil {
		return nil, 0, fmt.Errorf("querying starred repos: %w", err)
	}

	return repos, total, nil
}

func (s *TrendingStore) GetUserLanguages(ctx context.Context, username string) (map[string]int, error) {
	type result struct {
		Language string
		Count    int
	}
	var results []result
	if err := s.db.WithContext(ctx).
		Model(&model.GitHubStarred{}).
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

// --- Product Hunt ---

func (s *TrendingStore) UpsertProductHunt(ctx context.Context, records []model.ProductHunt) error {
	if len(records) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		UpdateAll: true,
	}).CreateInBatches(records, 100).Error
}

func (s *TrendingStore) GetProductHunt(ctx context.Context, day string, limit, offset int) ([]model.ProductHunt, int64, error) {
	var total int64
	var products []model.ProductHunt

	query := s.db.WithContext(ctx).Model(&model.ProductHunt{})
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

func (s *TrendingStore) GetCategories(ctx context.Context) ([]string, error) {
	var products []model.ProductHunt
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

// --- Stats ---

func (s *TrendingStore) GetStats(ctx context.Context) (totalTrending, totalStarred, totalPH int64, lastFetch map[string]*time.Time, err error) {
	lastFetch = make(map[string]*time.Time)

	if err := s.db.WithContext(ctx).Model(&model.GitHubTrending{}).Count(&totalTrending).Error; err != nil {
		return 0, 0, 0, nil, fmt.Errorf("counting trending: %w", err)
	}
	if err := s.db.WithContext(ctx).Model(&model.GitHubStarred{}).Count(&totalStarred).Error; err != nil {
		return 0, 0, 0, nil, fmt.Errorf("counting starred: %w", err)
	}
	if err := s.db.WithContext(ctx).Model(&model.ProductHunt{}).Count(&totalPH).Error; err != nil {
		return 0, 0, 0, nil, fmt.Errorf("counting producthunt: %w", err)
	}

	var lastTrending model.GitHubTrending
	if err := s.db.WithContext(ctx).Model(&model.GitHubTrending{}).Order("fetched_at DESC").First(&lastTrending).Error; err == nil {
		lastFetch["github_trending"] = &lastTrending.FetchedAt
	}

	var lastStarred model.GitHubStarred
	if err := s.db.WithContext(ctx).Model(&model.GitHubStarred{}).Order("fetched_at DESC").First(&lastStarred).Error; err == nil {
		lastFetch["github_starred"] = &lastStarred.FetchedAt
	}

	var lastPH model.ProductHunt
	if err := s.db.WithContext(ctx).Model(&model.ProductHunt{}).Order("fetched_at DESC").First(&lastPH).Error; err == nil {
		lastFetch["product_hunt"] = &lastPH.FetchedAt
	}

	return totalTrending, totalStarred, totalPH, lastFetch, nil
}
