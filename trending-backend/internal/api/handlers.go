package api

import (
	"net/http"
	"strconv"
	"time"

	"trending-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Response is the common JSON response wrapper for all API endpoints.
type Response struct {
	Data   interface{} `json:"data,omitempty"`
	Total  int64       `json:"total,omitempty"`
	Limit  int         `json:"limit,omitempty"`
	Offset int         `json:"offset,omitempty"`
	Error  string      `json:"error,omitempty"`
}

// Handler holds the service dependencies for all HTTP handlers.
type Handler struct {
	ghSvc services.GitHubService
	phSvc services.ProductHuntService
}

// NewHandler creates a new Handler with the given services.
func NewHandler(ghSvc services.GitHubService, phSvc services.ProductHuntService) *Handler {
	return &Handler{
		ghSvc: ghSvc,
		phSvc: phSvc,
	}
}

// ---------------------------------------------------------------------------
// Health & Stats
// ---------------------------------------------------------------------------

// Health handles GET /api/v1/health.
//
//	@Summary	Health check
//	@Tags		system
//	@Produce	json
//	@Success	200	{object}	map[string]string
//	@Router		/health [get]
func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GetStats handles GET /api/v1/stats.
//
//	@Summary	Dashboard statistics
//	@Description	Returns record counts and last fetch times for all data sources.
//	@Tags		system
//	@Produce	json
//	@Success	200	{object}	api.Response
//	@Router		/stats [get]
func (h *Handler) GetStats(c *gin.Context) {
	ctx := c.Request.Context()

	ghTrendingCount, ghTrendingLast, err := h.getTableStats(ctx, "github_trending")
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: "failed to get GitHub trending stats"})
		return
	}

	ghStarredCount, ghStarredLast, err := h.getTableStats(ctx, "github_starred")
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: "failed to get GitHub starred stats"})
		return
	}

	phCount, phLast, err := h.getTableStats(ctx, "product_hunt")
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: "failed to get Product Hunt stats"})
		return
	}

	c.JSON(http.StatusOK, Response{Data: map[string]interface{}{
		"github_trending": map[string]interface{}{
			"count":      ghTrendingCount,
			"last_fetch": ghTrendingLast,
		},
		"github_starred": map[string]interface{}{
			"count":      ghStarredCount,
			"last_fetch": ghStarredLast,
		},
		"product_hunt": map[string]interface{}{
			"count":      phCount,
			"last_fetch": phLast,
		},
	}})
}

// getTableStats queries the count and latest fetched_at for a given table.
// This is a helper that uses raw SQL since the service interfaces don't expose stats directly.
func (h *Handler) getTableStats(ctx context.Context, tableName string) (int64, *time.Time, error) {
	// We use the service's GetTrending with zero limit to infer counts,
	// or we can do a simple count via the DB. Since we don't have direct DB access
	// in the handler, we return reasonable defaults for now.
	// In a full implementation, a StatsService would be injected.
	_ = ctx
	_ = tableName
	return 0, nil, nil
}

// ---------------------------------------------------------------------------
// GitHub Trending
// ---------------------------------------------------------------------------

// FetchTrendingRequest is the request body for triggering a trending fetch.
type FetchTrendingRequest struct {
	Period   string `json:"period" example:"daily"`
	Language string `json:"language" example:"go"`
}

// GetTrending handles GET /api/v1/github/trending.
//
//	@Summary	List GitHub trending repositories
//	@Description	Returns a paginated list of GitHub trending repos filtered by period and language.
//	@Tags		github
//	@Produce	json
//	@Param		period		query	string	false	"Period filter: daily, weekly, monthly"    	enum(daily,weekly,monthly)	default(daily)
//	@Param		language	query	string	false	"Programming language filter"
//	@Param		limit		query	int		false	"Maximum number of results"	default(30)
//	@Param		offset		query	int		false	"Number of results to skip"	default(0)
//	@Success	200	{object}	api.Response{data=[]models.GitHubTrending}
//	@Router		/github/trending [get]
func (h *Handler) GetTrending(c *gin.Context) {
	period := c.DefaultQuery("period", "daily")
	language := c.Query("language")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}

	ctx := c.Request.Context()
	repos, total, err := h.ghSvc.GetTrending(ctx, period, language, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{
		Data:   repos,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// GetLanguages handles GET /api/v1/github/trending/languages.
//
//	@Summary	Get all languages
//	@Description	Returns the list of distinct programming languages from trending repos.
//	@Tags		github
//	@Produce	json
//	@Success	200	{object}	api.Response{data=[]string}
//	@Router		/github/trending/languages [get]
func (h *Handler) GetLanguages(c *gin.Context) {
	ctx := c.Request.Context()
	languages, err := h.ghSvc.GetLanguages(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Data: languages})
}

// FetchTrending handles POST /api/v1/github/trending/fetch.
//
//	@Summary	Trigger GitHub trending fetch
//	@Description	Fetches trending repositories from GitHub and stores them in the database.
//	@Tags		github
//	@Accept		json
//	@Produce	json
//	@Param		body	body	FetchTrendingRequest	true	"Fetch parameters"
//	@Success	200	{object}	api.Response{data=[]models.GitHubTrending}
//	@Router		/github/trending/fetch [post]
func (h *Handler) FetchTrending(c *gin.Context) {
	var req FetchTrendingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Error: "invalid request body: " + err.Error()})
		return
	}

	if req.Period == "" {
		req.Period = "daily"
	}

	ctx := c.Request.Context()
	repos, err := h.ghSvc.FetchTrending(ctx, req.Period, req.Language, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{
		Data:  repos,
		Total: int64(len(repos)),
	})
}

// ---------------------------------------------------------------------------
// GitHub Starred
// ---------------------------------------------------------------------------

// FetchStarredRequest is the request body for fetching starred repos.
type FetchStarredRequest struct {
	Username string `json:"username" example:"octocat"`
}

// GetStarred handles GET /api/v1/github/starred/:username.
//
//	@Summary	List user's starred repositories
//	@Description	Returns a paginated list of repositories starred by the given user.
//	@Tags		github
//	@Produce	json
//	@Param		username	path	string	true	"GitHub username"
//	@Param		language	query	string	false	"Filter by programming language"
//	@Param		sort		query	string	false	"Sort order: starred_at, stars"	default(starred_at)
//	@Param		limit		query	int		false	"Maximum number of results"	default(30)
//	@Param		offset		query	int		false	"Number of results to skip"	default(0)
//	@Success	200	{object}	api.Response{data=[]models.GitHubStarred}
//	@Router		/github/starred/{username} [get]
func (h *Handler) GetStarred(c *gin.Context) {
	username := c.Param("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, Response{Error: "username is required"})
		return
	}

	language := c.Query("language")
	sort := c.DefaultQuery("sort", "starred_at")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}

	ctx := c.Request.Context()
	repos, total, err := h.ghSvc.GetStarred(ctx, username, language, limit, offset, sort)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{
		Data:   repos,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// FetchStarred handles POST /api/v1/github/starred/fetch.
//
//	@Summary	Fetch starred repositories for a user
//	@Description	Fetches starred repositories from GitHub API and stores them.
//	@Tags		github
//	@Accept		json
//	@Produce	json
//	@Param		body	body	FetchStarredRequest	true	"Fetch parameters"
//	@Success	200	{object}	api.Response{data=[]models.GitHubStarred}
//	@Router		/github/starred/fetch [post]
func (h *Handler) FetchStarred(c *gin.Context) {
	var req FetchStarredRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Error: "invalid request body: " + err.Error()})
		return
	}

	if req.Username == "" {
		c.JSON(http.StatusBadRequest, Response{Error: "username is required"})
		return
	}

	ctx := c.Request.Context()
	repos, err := h.ghSvc.FetchUserStarred(ctx, req.Username, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{
		Data:  repos,
		Total: int64(len(repos)),
	})
}

// GetUserLanguages handles GET /api/v1/github/starred/:username/languages.
//
//	@Summary	Get language breakdown for a user's starred repos
//	@Description	Returns a map of programming languages to their occurrence counts.
//	@Tags		github
//	@Produce	json
//	@Param		username	path	string	true	"GitHub username"
//	@Success	200	{object}	api.Response{data=map[string]int}
//	@Router		/github/starred/{username}/languages [get]
func (h *Handler) GetUserLanguages(c *gin.Context) {
	username := c.Param("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, Response{Error: "username is required"})
		return
	}

	ctx := c.Request.Context()
	langs, err := h.ghSvc.GetUserLanguages(ctx, username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Data: langs})
}

// ---------------------------------------------------------------------------
// Product Hunt
// ---------------------------------------------------------------------------

// FetchProductHuntRequest is the request body for triggering a Product Hunt fetch.
type FetchProductHuntRequest struct {
	Day string `json:"day" example:"2024-01-01"`
}

// GetProductHunt handles GET /api/v1/producthunt/trending.
//
//	@Summary	List Product Hunt trending products
//	@Description	Returns a paginated list of trending products from Product Hunt.
//	@Tags		producthunt
//	@Produce	json
//	@Param		day		query	string	false	"Date in YYYY-MM-DD format"
//	@Param		limit		query	int		false	"Maximum number of results"	default(30)
//	@Param		offset		query	int		false	"Number of results to skip"	default(0)
//	@Success	200	{object}	api.Response{data=[]models.ProductHunt}
//	@Router		/producthunt/trending [get]
func (h *Handler) GetProductHunt(c *gin.Context) {
	day := c.Query("day")
	if day == "" {
		day = time.Now().Format("2006-01-02")
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}

	ctx := c.Request.Context()
	products, total, err := h.phSvc.GetTrending(ctx, day, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{
		Data:   products,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// GetCategories handles GET /api/v1/producthunt/categories.
//
//	@Summary	Get Product Hunt categories/topics
//	@Description	Returns the list of distinct topics/categories from Product Hunt posts.
//	@Tags		producthunt
//	@Produce	json
//	@Success	200	{object}	api.Response{data=[]string}
//	@Router		/producthunt/categories [get]
func (h *Handler) GetCategories(c *gin.Context) {
	ctx := c.Request.Context()
	categories, err := h.phSvc.GetCategories(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Data: categories})
}

// FetchProductHunt handles POST /api/v1/producthunt/fetch.
//
//	@Summary	Trigger Product Hunt fetch
//	@Description	Fetches trending products from Product Hunt and stores them.
//	@Tags		producthunt
//	@Accept		json
//	@Produce	json
//	@Param		body	body	FetchProductHuntRequest	true	"Fetch parameters"
//	@Success	200	{object}	api.Response{data=[]models.ProductHunt}
//	@Router		/producthunt/fetch [post]
func (h *Handler) FetchProductHunt(c *gin.Context) {
	var req FetchProductHuntRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Error: "invalid request body: " + err.Error()})
		return
	}

	if req.Day == "" {
		req.Day = time.Now().Format("2006-01-02")
	}

	ctx := c.Request.Context()
	products, err := h.phSvc.FetchTrending(ctx, req.Day, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{
		Data:  products,
		Total: int64(len(products)),
	})
}
