package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/innate/hub/internal/adapter"
	ghadapter "github.com/innate/hub/internal/adapter/githubtrending"
	rssadapter "github.com/innate/hub/internal/adapter/rss"
	tradapter "github.com/innate/hub/internal/adapter/trendradar"
	"github.com/innate/hub/internal/config"
	"github.com/innate/hub/internal/embedder"
	"github.com/innate/hub/internal/handler"
	"github.com/innate/hub/internal/pull"
	"github.com/innate/hub/internal/store"
	trendingstore "github.com/innate/hub/internal/trending/store"
	"github.com/gin-gonic/gin"
	"github.com/mattn/go-isatty"
	"golang.org/x/sync/errgroup"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	setupLogger(cfg)
	gin.SetMode(gin.ReleaseMode)

	st, err := store.New(cfg.DBPath)
	if err != nil {
		return err
	}
	defer st.Close()

	// Build the adapter registry.
	// Adapters allow pluggable feed sources: RSS/Atom, TrendRadar SQLite, etc.
	reg := adapter.NewRegistry()
	reg.Register(rssadapter.New(cfg.AllowPrivateFeeds))

	// Trending stores (GitHub, ProductHunt) — optional, only if tokens/config available.
	var trStore *trendingstore.TrendingStore
	if st.DB() != nil {
		var err error
		trStore, err = trendingstore.New(st.DB(), st.Driver())
		if err != nil {
			slog.Warn("failed to init trending store", "error", err)
		} else if err := trStore.AutoMigrate(); err != nil {
			slog.Warn("failed to migrate trending tables", "error", err)
			trStore = nil
		}
	}

	if trStore != nil {
		reg.Register(ghadapter.New(cfg.GitHubToken, cfg.GitHubAPIURL, trStore))
	}

	// TrendRadar adapter reads from TrendRadar's daily SQLite databases.
	// Set TRENDRADAR_DATA_DIR env var to override the default path.
	trDataDir := os.Getenv("TRENDRADAR_DATA_DIR")
	if trDataDir == "" {
		trDataDir = "TrendRadar/output/news"
	}
	reg.Register(tradapter.New(trDataDir))

	// Initialize semantic search embedder (optional).
	emb, err := embedder.New(embedder.Config{
		Provider: cfg.EmbedderProvider,
		Model:    cfg.EmbedderModel,
		BaseURL:  cfg.EmbedderBaseURL,
		APIKey:   cfg.EmbedderAPIKey,
	})
	if err != nil {
		slog.Warn("embedder init failed, semantic search disabled", "error", err)
	} else if emb != nil {
		slog.Info("embedder initialized", "provider", cfg.EmbedderProvider, "model", cfg.EmbedderModel, "dims", emb.Dimensions())
	}

	puller := pull.New(st, cfg, reg, emb)

	// Auto-create TrendRadar feed if not exists.
	if err := ensureTrendRadarFeed(st, trDataDir); err != nil {
		slog.Warn("failed to ensure trendradar feed", "error", err)
	}

	h, err := handler.New(st, trStore, cfg, emb, puller)
	if err != nil {
		return err
	}
	r := h.SetupRouter()

	addr := ":" + strconv.Itoa(cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	sigCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	g, ctx := errgroup.WithContext(sigCtx)

	g.Go(func() error {
		slog.Info("starting server", "address", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	})

	g.Go(func() error {
		if err := puller.Start(ctx); err != nil && !errors.Is(err, context.Canceled) {
			return err
		}
		return nil
	})

	g.Go(func() error {
		<-ctx.Done()
		slog.Info("shutting down")

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("failed to shutdown server", "error", err)
		}

		return nil
	})

	return g.Wait()
}

func ensureTrendRadarFeed(st *store.Store, dataDir string) error {
	feeds, err := st.ListFeeds()
	if err != nil {
		return err
	}
	for _, f := range feeds {
		if f.SourceType == "trendradar" {
			return nil // already exists
		}
	}

	// Create a special TrendRadar feed.
	_, err = st.CreateFeed(1, "TrendRadar Hot News", dataDir, "", "")
	if err != nil {
		return err
	}

	// Update its source_type to trendradar.
	// We need to find the newly created feed by link.
	freshFeeds, err := st.ListFeeds()
	if err != nil {
		return err
	}
	for _, f := range freshFeeds {
		if f.SourceType == "rss" && f.Link == dataDir {
			st.UpdateFeed(f.ID, store.UpdateFeedParams{SourceType: strPtr("trendradar")})
			break
		}
	}

	slog.Info("auto-created trendradar feed", "data_dir", dataDir)
	return nil
}

func strPtr(s string) *string {
	return &s
}

func setupLogger(cfg *config.Config) {
	var level slog.Level
	switch cfg.LogLevel {
	case "DEBUG":
		level = slog.LevelDebug
	case "INFO":
		level = slog.LevelInfo
	case "WARN":
		level = slog.LevelWarn
	case "ERROR":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level: level,
	}

	var handler slog.Handler
	switch cfg.LogFormat {
	case "json":
		handler = slog.NewJSONHandler(os.Stdout, opts)
	case "text":
		handler = slog.NewTextHandler(os.Stdout, opts)
	case "auto":
		if isatty.IsTerminal(os.Stdout.Fd()) {
			handler = slog.NewTextHandler(os.Stdout, opts)
		} else {
			handler = slog.NewJSONHandler(os.Stdout, opts)
		}
	default:
		if isatty.IsTerminal(os.Stdout.Fd()) {
			handler = slog.NewTextHandler(os.Stdout, opts)
		} else {
			handler = slog.NewJSONHandler(os.Stdout, opts)
		}
	}

	logger := slog.New(handler)
	slog.SetDefault(logger)
}
