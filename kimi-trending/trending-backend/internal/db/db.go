package db

import (
	"fmt"
	"log/slog"
	"sync"

	"trending-backend/internal/config"
	"trending-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	instance *gorm.DB
	once     sync.Once
)

// Get returns the singleton *gorm.DB instance.
func Get() *gorm.DB {
	once.Do(func() {
		cfg := config.Get()
		dsn := cfg.DatabaseDSN()

		var dialector gorm.Dialector
		switch cfg.DBDriver {
		case "postgres":
			dialector = postgres.Open(dsn)
		slog.Info("connecting to PostgreSQL", "host", cfg.DBHost, "port", cfg.DBPort, "dbname", cfg.DBName)
		case "sqlite":
			dialector = sqlite.Open(dsn + "?_journal=WAL&_busy_timeout=5000")
			slog.Info("connecting to SQLite", "path", dsn)
		default:
			dialector = sqlite.Open(dsn + "?_journal=WAL&_busy_timeout=5000")
			slog.Info("unknown driver, defaulting to SQLite", "driver", cfg.DBDriver)
		}

		db, err := gorm.Open(dialector, &gorm.Config{
			Logger: logger.Default.LogMode(logger.Silent),
		})
		if err != nil {
			slog.Error("failed to connect to database", "error", err)
			panic(fmt.Sprintf("database connection failed: %v", err))
		}

		sqlDB, err := db.DB()
		if err != nil {
			slog.Error("failed to get underlying sql.DB", "error", err)
			panic(err)
		}

		sqlDB.SetMaxOpenConns(10)
		sqlDB.SetMaxIdleConns(5)

		if err := db.AutoMigrate(
			&models.GitHubTrending{},
			&models.GitHubStarred{},
			&models.ProductHunt{},
		); err != nil {
			slog.Error("failed to run auto-migration", "error", err)
			panic(err)
		}

		slog.Info("database initialized and migrations completed")
		instance = db
	})
	return instance
}
