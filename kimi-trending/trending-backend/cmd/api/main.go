package main

import (
	"log/slog"
	"os"

	"trending-backend/internal/api"
	"trending-backend/internal/config"
	"trending-backend/internal/db"
	"trending-backend/internal/services"
	"trending-backend/pkg/github"
	"trending-backend/pkg/producthunt"
)

// @title Trending Aggregator API
// @version 1.0
// @description REST API for GitHub Trending, Starred Repos, and Product Hunt
// @host localhost:8080
// @BasePath /api/v1
func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg := config.Get()
	database := db.Get()

	ghClient := github.NewClient(cfg.GitHubToken, cfg.GitHubAPIURL)
	phClient := producthunt.NewClient(cfg.ProductHuntToken, cfg.ProductHuntAPIURL)

	ghSvc := services.NewGitHubService(ghClient, database)
	phSvc := services.NewProductHuntService(phClient, database)

	r := api.SetupRouter(ghSvc, phSvc)

	slog.Info("API server starting", "address", cfg.APIAddress())
	if err := r.Run(cfg.APIAddress()); err != nil {
		slog.Error("server failed to start", "error", err)
		os.Exit(1)
	}
}
