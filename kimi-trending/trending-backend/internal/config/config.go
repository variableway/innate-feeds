package config

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"github.com/caarlos0/env/v10"
	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// Database
	DBDriver   string `env:"DB_DRIVER" envDefault:"sqlite"`
	DBHost     string `env:"DB_HOST" envDefault:"localhost"`
	DBPort     int    `env:"DB_PORT" envDefault:"5432"`
	DBUser     string `env:"DB_USER" envDefault:"trending"`
	DBPassword string `env:"DB_PASSWORD" envDefault:""`
	DBName     string `env:"DB_NAME" envDefault:"trending.db"`
	DBSSLMode  string `env:"DB_SSL_MODE" envDefault:"disable"`

	// API Server
	APIHost         string `env:"API_HOST" envDefault:"0.0.0.0"`
	APIPort         int    `env:"API_PORT" envDefault:"8080"`
	APIReadTimeout  int    `env:"API_READ_TIMEOUT" envDefault:"30"`
	APIWriteTimeout int    `env:"API_WRITE_TIMEOUT" envDefault:"30"`

	// GitHub
	GitHubToken  string `env:"GITHUB_TOKEN" envDefault:""`
	GitHubAPIURL string `env:"GITHUB_API_URL" envDefault:"https://api.github.com"`

	// Product Hunt
	ProductHuntToken  string `env:"PRODUCTHUNT_TOKEN" envDefault:""`
	ProductHuntAPIURL string `env:"PRODUCTHUNT_API_URL" envDefault:"https://api.producthunt.com/v2/api/graphql"`

	// Scheduler
	FetchInterval int `env:"FETCH_INTERVAL" envDefault:"3600"`

	// TUI
	TUIRefreshRate int `env:"TUI_REFRESH_RATE" envDefault:"5"`
}

var (
	instance *Config
	once     sync.Once
)

// Get returns the singleton Config instance, initializing it on first call.
func Get() *Config {
	once.Do(func() {
		if err := godotenv.Load(); err != nil {
			slog.Debug("no .env file found, using environment variables only")
		}

		cfg := &Config{}
		if err := env.Parse(cfg); err != nil {
			slog.Error("failed to parse config from environment", "error", err)
			os.Exit(1)
		}

		instance = cfg
		slog.Info("configuration loaded",
			"db_driver", cfg.DBDriver,
			"api_port", cfg.APIPort,
		)
	})
	return instance
}

// DatabaseDSN returns the appropriate connection string based on DBDriver.
func (c *Config) DatabaseDSN() string {
	switch c.DBDriver {
	case "postgres":
		return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode)
	case "sqlite":
		dbPath := c.DBName
		if !filepath.IsAbs(dbPath) {
			dbPath = filepath.Join(".", dbPath)
		}
		return dbPath
	default:
		return c.DBName
	}
}

// APIAddress returns the full host:port string for the API server.
func (c *Config) APIAddress() string {
	return fmt.Sprintf("%s:%d", c.APIHost, c.APIPort)
}
