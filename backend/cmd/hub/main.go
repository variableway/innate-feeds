package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/innate/hub/internal/adapter"
	fusionadapter "github.com/innate/hub/internal/adapter/fusion"
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

	// Fusion sources — treat each remote Fusion instance as a feed source.
	if err := registerFusionSources(reg, st, cfg.FusionSourcesJSON); err != nil {
		slog.Warn("failed to register fusion sources", "error", err)
	}

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

// fusionSource is the JSON shape of a single FUSION_SOURCES_JSON entry.
type fusionSource struct {
	Name     string `json:"name"`
	BaseURL  string `json:"base_url"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// registerFusionSources parses FUSION_SOURCES_JSON, registers one Fusion
// adapter per source, and creates (or reuses) a feed row for each so the
// puller has somewhere to write items into.
func registerFusionSources(reg *adapter.Registry, st *store.Store, raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var sources []fusionSource
	if err := json.Unmarshal([]byte(raw), &sources); err != nil {
		return fmt.Errorf("parse FUSION_SOURCES_JSON: %w", err)
	}

	// Fusion source names are unique — one adapter per source name.
	// We can't actually register the same Name() twice; a single adapter
	// covers one base_url. Group by base_url.
	byURL := make(map[string]fusionSource, len(sources))
	for _, s := range sources {
		if strings.TrimSpace(s.BaseURL) == "" {
			slog.Warn("fusion source missing base_url, skipping", "name", s.Name)
			continue
		}
		key := strings.TrimRight(s.BaseURL, "/")
		if existing, ok := byURL[key]; ok {
			slog.Warn("duplicate fusion base_url, using first", "name", existing.Name, "duplicate", s.Name)
			continue
		}
		byURL[key] = s
	}

	for _, s := range byURL {
		adp := fusionadapter.New(s.BaseURL, s.Username, s.Password)
		reg.Register(adp)

		// Auto-create a feed row with source_type="fusion" so the puller
		// can iterate over it on every cycle.
		if err := ensureFusionFeed(st, s); err != nil {
			slog.Warn("failed to ensure fusion feed", "name", s.Name, "error", err)
		}
	}
	return nil
}

func ensureFusionFeed(st *store.Store, s fusionSource) error {
	feeds, err := st.ListFeeds()
	if err != nil {
		return err
	}
	for _, f := range feeds {
		if f.SourceType == "fusion" && f.Link == s.BaseURL {
			return nil // already exists
		}
	}
	name := s.Name
	if strings.TrimSpace(name) == "" {
		name = "Fusion: " + s.BaseURL
	}
	_, err = st.CreateFeed(1, name, s.BaseURL, "", "")
	if err != nil {
		return err
	}
	// Update source_type to "fusion".
	fresh, err := st.ListFeeds()
	if err != nil {
		return err
	}
	for _, f := range fresh {
		if f.Link == s.BaseURL && f.SourceType == "rss" {
			if uerr := st.UpdateFeed(f.ID, store.UpdateFeedParams{SourceType: strPtr("fusion")}); uerr != nil {
				return uerr
			}
			break
		}
	}
	slog.Info("auto-created fusion feed", "name", name, "base_url", s.BaseURL)
	return nil
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
