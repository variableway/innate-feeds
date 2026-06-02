package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/innate/hub/internal/trending/pkg/github"
	"github.com/innate/hub/internal/trending/pkg/producthunt"
	"github.com/innate/hub/internal/trending/service"
	"github.com/innate/hub/internal/trending/store"
	"github.com/gin-gonic/gin"
)

// TrendingHandler holds trending-related handlers.
type TrendingHandler struct {
	ghSvc service.GitHubService
	phSvc service.ProductHuntService
}

// NewTrendingHandler creates a new TrendingHandler.
func NewTrendingHandler(ghSvc service.GitHubService, phSvc service.ProductHuntService) *TrendingHandler {
	return &TrendingHandler{
		ghSvc: ghSvc,
		phSvc: phSvc,
	}
}

// --- Request / Response types ---

type trendingResponse struct {
	Data   any    `json:"data"`
	Total  int64  `json:"total,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
	Error  string `json:"error,omitempty"`
}

type fetchTrendingRequest struct {
	Period   string `json:"period"`
	Language string `json:"language"`
}

type fetchStarredRequest struct {
	Username string `json:"username"`
}

type fetchProductHuntRequest struct {
	Day string `json:"day"`
}

type statsResponse struct {
	TotalTrending  int64                  `json:"total_trending"`
	TotalStarred   int64                  `json:"total_starred"`
	TotalProductHunt int64                `json:"total_producthunt"`
	LastFetch      map[string]*time.Time  `json:"last_fetch"`
}

// --- Handlers ---

func (h *TrendingHandler) getStats(c *gin.Context) {
	// Stats are handled by the main handler which has store access.
	// This is a placeholder; actual stats will be wired in router setup.
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GetTrending lists GitHub trending repos.
func (h *TrendingHandler) GetTrending(c *gin.Context) {
	period := c.Query("period")
	language := c.Query("language")
	limit, _ := strconv.Atoi(c.Query("limit"))
	offset, _ := strconv.Atoi(c.Query("offset"))

	repos, total, err := h.ghSvc.GetTrending(c.Request.Context(), period, language, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, trendingResponse{Data: repos, Total: total, Limit: limit, Offset: offset})
}

// FetchTrending triggers a GitHub trending fetch.
func (h *TrendingHandler) FetchTrending(c *gin.Context) {
	var req fetchTrendingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, trendingResponse{Error: err.Error()})
		return
	}

	records, err := h.ghSvc.FetchTrending(c.Request.Context(), req.Period, req.Language, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "count": len(records)})
}

// GetLanguages returns distinct languages from trending repos.
func (h *TrendingHandler) GetLanguages(c *gin.Context) {
	languages, err := h.ghSvc.GetLanguages(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": languages})
}

// GetStarred lists starred repos for a user.
func (h *TrendingHandler) GetStarred(c *gin.Context) {
	username := c.Param("username")
	language := c.Query("language")
	sort := c.Query("sort")
	limit, _ := strconv.Atoi(c.Query("limit"))
	offset, _ := strconv.Atoi(c.Query("offset"))

	repos, total, err := h.ghSvc.GetStarred(c.Request.Context(), username, language, limit, offset, sort)
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, trendingResponse{Data: repos, Total: total, Limit: limit, Offset: offset})
}

// FetchStarred triggers a starred repos fetch.
func (h *TrendingHandler) FetchStarred(c *gin.Context) {
	var req fetchStarredRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, trendingResponse{Error: err.Error()})
		return
	}

	records, err := h.ghSvc.FetchUserStarred(c.Request.Context(), req.Username, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "username": req.Username, "count": len(records)})
}

// GetUserLanguages returns language breakdown for a user's starred repos.
func (h *TrendingHandler) GetUserLanguages(c *gin.Context) {
	username := c.Param("username")

	breakdown, err := h.ghSvc.GetUserLanguages(c.Request.Context(), username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": breakdown})
}

// GetProductHunt lists Product Hunt products.
func (h *TrendingHandler) GetProductHunt(c *gin.Context) {
	day := c.Query("day")
	limit, _ := strconv.Atoi(c.Query("limit"))
	offset, _ := strconv.Atoi(c.Query("offset"))

	products, total, err := h.phSvc.GetTrending(c.Request.Context(), day, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, trendingResponse{Data: products, Total: total, Limit: limit, Offset: offset})
}

// FetchProductHunt triggers a Product Hunt fetch.
func (h *TrendingHandler) FetchProductHunt(c *gin.Context) {
	var req fetchProductHuntRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, trendingResponse{Error: err.Error()})
		return
	}

	records, err := h.phSvc.FetchTrending(c.Request.Context(), req.Day, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "count": len(records)})
}

// GetCategories returns distinct Product Hunt categories.
func (h *TrendingHandler) GetCategories(c *gin.Context) {
	categories, err := h.phSvc.GetCategories(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, trendingResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}

// --- Wiring helpers ---

// SetupTrendingRoutes mounts trending routes on the given router group.
func SetupTrendingRoutes(api *gin.RouterGroup, cfg struct {
	GitHubToken       string
	GitHubAPIURL      string
	ProductHuntToken  string
	ProductHuntAPIURL string
}, st *store.TrendingStore) *TrendingHandler {
	ghClient := github.NewClient(cfg.GitHubToken, cfg.GitHubAPIURL)
	phClient := producthunt.NewClient(cfg.ProductHuntToken, cfg.ProductHuntAPIURL)

	ghSvc := service.NewGitHubService(ghClient, st)
	phSvc := service.NewProductHuntService(phClient, st)

	h := NewTrendingHandler(ghSvc, phSvc)

	api.GET("/trending/stats", h.getStats)
	api.GET("/trending/github/trending", h.GetTrending)
	api.POST("/trending/github/trending/fetch", h.FetchTrending)
	api.GET("/trending/github/trending/languages", h.GetLanguages)
	api.GET("/trending/github/starred/:username", h.GetStarred)
	api.POST("/trending/github/starred/fetch", h.FetchStarred)
	api.GET("/trending/github/starred/:username/languages", h.GetUserLanguages)
	api.GET("/trending/producthunt", h.GetProductHunt)
	api.POST("/trending/producthunt/fetch", h.FetchProductHunt)
	api.GET("/trending/producthunt/categories", h.GetCategories)

	return h
}
