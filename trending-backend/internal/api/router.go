package api

import (
	"trending-backend/internal/services"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "trending-backend/internal/api/docs" // import for swagger init side-effects
)

// SetupRouter creates and configures the Gin engine with all routes.
//
// It registers middleware (CORS, recovery, logging), groups all API routes
// under /api/v1, and wires the Swagger UI at /swagger/*any.
func SetupRouter(ghSvc services.GitHubService, phSvc services.ProductHuntService) *gin.Engine {
	r := gin.New()

	// Global middleware
	r.Use(RequestLogger())
	r.Use(ErrorRecovery())
	r.Use(CORSMiddleware())

	// Initialize handlers
	h := NewHandler(ghSvc, phSvc)

	// API v1 group
	v1 := r.Group("/api/v1")
	{
		// Health
		v1.GET("/health", h.Health)

		// Stats
		v1.GET("/stats", h.GetStats)

		// GitHub Trending
		v1.GET("/github/trending", h.GetTrending)
		v1.GET("/github/trending/languages", h.GetLanguages)
		v1.POST("/github/trending/fetch", h.FetchTrending)

		// GitHub Starred
		v1.GET("/github/starred/:username", h.GetStarred)
		v1.POST("/github/starred/fetch", h.FetchStarred)
		v1.GET("/github/starred/:username/languages", h.GetUserLanguages)

		// Product Hunt
		v1.GET("/producthunt/trending", h.GetProductHunt)
		v1.GET("/producthunt/categories", h.GetCategories)
		v1.POST("/producthunt/fetch", h.FetchProductHunt)
	}

	// Swagger UI
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	return r
}
