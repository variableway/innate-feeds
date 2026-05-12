package cli

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"trending-backend/internal/config"
	"trending-backend/internal/db"
	"trending-backend/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(serveCmd)
	serveCmd.Flags().IntP("port", "p", 0, "API server port (overrides config)")
	serveCmd.Flags().StringP("host", "H", "", "API server host (overrides config)")
}

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the REST API server",
	Long:  `Start the Gin-based REST API server that serves trending data via HTTP endpoints.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg := config.Get()
		_ = db.Get()

		// Allow CLI flags to override config
		port, _ := cmd.Flags().GetInt("port")
		host, _ := cmd.Flags().GetString("host")

		if port > 0 {
			cfg.APIPort = port
		}
		if host != "" {
			cfg.APIHost = host
		}

		addr := cfg.APIAddress()
		fmt.Printf("Starting API server on http://%s\n", addr)

		// Initialize services
		ghSvc := services.NewGitHubService()
		phSvc := services.NewProductHuntService()

		// Set up Gin router
		gin.SetMode(gin.ReleaseMode)
		r := gin.New()
		r.Use(gin.Recovery())
		r.Use(gin.Logger())
		r.Use(cors.Default())

		// Health check
		r.GET("/api/v1/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok", "timestamp": time.Now().UTC()})
		})

		// Stats endpoint
		r.GET("/api/v1/stats", func(c *gin.Context) {
			stats := getStats(ghSvc, phSvc)
			c.JSON(http.StatusOK, stats)
		})

		// GitHub Trending routes
		r.GET("/api/v1/github/trending", func(c *gin.Context) {
			period := c.DefaultQuery("period", "daily")
			language := c.Query("language")
			limit := parseIntQuery(c, "limit", 30)
			offset := parseIntQuery(c, "offset", 0)

			repos, total, err := ghSvc.GetTrending(c.Request.Context(), period, language, limit, offset)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"data":   repos,
				"total":  total,
				"limit":  limit,
				"offset": offset,
			})
		})

		r.GET("/api/v1/github/trending/languages", func(c *gin.Context) {
			languages, err := ghSvc.GetLanguages(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"data": languages})
		})

		r.POST("/api/v1/github/trending/fetch", func(c *gin.Context) {
			var req struct {
				Period   string `json:"period"`
				Language string `json:"language"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if req.Period == "" {
				req.Period = "daily"
			}

			repos, err := ghSvc.FetchTrending(c.Request.Context(), req.Period, req.Language, 100)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"message": "fetch completed",
				"count":   len(repos),
			})
		})

		// GitHub Starred routes
		r.GET("/api/v1/github/starred/:username", func(c *gin.Context) {
			username := c.Param("username")
			language := c.Query("language")
			limit := parseIntQuery(c, "limit", 30)
			offset := parseIntQuery(c, "offset", 0)
			sort := c.DefaultQuery("sort", "starred_at")

			repos, total, err := ghSvc.GetStarred(c.Request.Context(), username, language, limit, offset, sort)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"data":   repos,
				"total":  total,
				"limit":  limit,
				"offset": offset,
			})
		})

		r.POST("/api/v1/github/starred/fetch", func(c *gin.Context) {
			var req struct {
				Username string `json:"username" binding:"required"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			repos, err := ghSvc.FetchUserStarred(c.Request.Context(), req.Username, 100)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"message":  "fetch completed",
				"username": req.Username,
				"count":    len(repos),
			})
		})

		r.GET("/api/v1/github/starred/:username/languages", func(c *gin.Context) {
			username := c.Param("username")
			breakdown, err := ghSvc.GetUserLanguages(c.Request.Context(), username)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"data": breakdown})
		})

		// Product Hunt routes
		r.GET("/api/v1/producthunt/trending", func(c *gin.Context) {
			day := c.Query("day")
			limit := parseIntQuery(c, "limit", 30)
			offset := parseIntQuery(c, "offset", 0)

			products, total, err := phSvc.GetTrending(c.Request.Context(), day, limit, offset)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"data":   products,
				"total":  total,
				"limit":  limit,
				"offset": offset,
			})
		})

		r.GET("/api/v1/producthunt/categories", func(c *gin.Context) {
			categories, err := phSvc.GetCategories(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"data": categories})
		})

		r.POST("/api/v1/producthunt/fetch", func(c *gin.Context) {
			var req struct {
				Day string `json:"day"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			products, err := phSvc.FetchTrending(c.Request.Context(), req.Day, 100)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"message": "fetch completed",
				"count":   len(products),
				"day":     req.Day,
			})
		})

		srv := &http.Server{
			Addr:    addr,
			Handler: r,
		}

		// Graceful shutdown
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				slog.Error("server failed to start", "error", err)
			}
		}()

		slog.Info("API server started", "address", addr)
		<-quit

		slog.Info("shutting down server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("server forced to shutdown: %w", err)
		}

		slog.Info("server exited")
		return nil
	},
}

func getStats(ghSvc services.GitHubService, phSvc services.ProductHuntService) gin.H {
	var ghTrendingCount, ghStarredCount, productHuntCount int64

	db := db.Get()
	db.Model(&struct{ ID uint }{}).Table("github_trending").Count(&ghTrendingCount)
	db.Model(&struct{ ID uint }{}).Table("github_starred").Count(&ghStarredCount)
	db.Model(&struct{ ID uint }{}).Table("product_hunt").Count(&productHuntCount)

	return gin.H{
		"github_trending_count": ghTrendingCount,
		"github_starred_count":  ghStarredCount,
		"product_hunt_count":    productHuntCount,
		"timestamp":             time.Now().UTC(),
	}
}

func parseIntQuery(c *gin.Context, key string, defaultVal int) int {
	val := c.Query(key)
	if val == "" {
		return defaultVal
	}
	var result int
	_, err := fmt.Sscanf(val, "%d", &result)
	if err != nil {
		return defaultVal
	}
	if result < 0 {
		return defaultVal
	}
	return result
}
