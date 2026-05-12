package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/daos"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/cron"
)

type GitHubRepo struct {
	ID          int64       `json:"id"`
	Name        string      `json:"name"`
	FullName    string      `json:"full_name"`
	Description string      `json:"description"`
	HTMLURL     string      `json:"html_url"`
	Stargazers  int         `json:"stargazers_count"`
	Language    string      `json:"language"`
	ForksCount  int         `json:"forks_count"`
	Topics      []string    `json:"topics"`
	Owner       GitHubOwner `json:"owner"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
	PushedAt    time.Time   `json:"pushed_at"`
}

type GitHubOwner struct {
	Login string `json:"login"`
	ID    int64  `json:"id"`
}

type StarredRepoCollection struct {
	ID          string    `json:"id"`
	GitHubUser  string    `json:"github_user"`
	RepoID      int64     `json:"repo_id"`
	RepoName    string    `json:"repo_name"`
	FullName    string    `json:"full_name"`
	Description string    `json:"description"`
	HTMLURL     string    `json:"html_url"`
	StarNum     int       `json:"star_num"`
	Language    string    `json:"language"`
	ForkNum     int       `json:"fork_num"`
	Tags        string    `json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	PushedAt    time.Time `json:"pushed_at"`
	CollectedAt time.Time `json:"collected_at"`
}

type TrendingRepo struct {
	Name           string   `json:"name"`
	FullName       string   `json:"full_name"`
	Description    string   `json:"description"`
	HTMLURL        string   `json:"html_url"`
	Stargazers     int      `json:"stargazers_count"`
	Language       string   `json:"language"`
	ForksCount     int      `json:"forks_count"`
	Topics         []string `json:"topics"`
	StarsToday     int      `json:"stars_today"`
	TrendingPeriod string   `json:"trending_period"`
	Rank           int      `json:"rank"`
}

func main() {
	app := pocketbase.New()

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		if err := ensureCollections(app); err != nil {
			return err
		}
		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/github/starred/:username",
			Handler: func(c echo.Context) error {
				username := c.PathParam("username")
				if username == "" {
					return apis.NewBadRequestError("Username is required", nil)
				}

				repos, err := fetchGitHubStarredRepos(username)
				if err != nil {
					return apis.NewBadRequestError("Failed to fetch starred repos", err)
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"username": username,
					"count":    len(repos),
					"repos":    repos,
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		e.Router.AddRoute(echo.Route{
			Method: http.MethodPost,
			Path:   "/api/github/collect/:username",
			Handler: func(c echo.Context) error {
				username := c.PathParam("username")
				if username == "" {
					return apis.NewBadRequestError("Username is required", nil)
				}

				repos, err := fetchGitHubStarredRepos(username)
				if err != nil {
					return apis.NewBadRequestError("Failed to fetch starred repos", err)
				}

				collection, err := app.Dao().FindCollectionByNameOrId("starred_repos")
				if err != nil {
					return apis.NewBadRequestError("Collection not found", err)
				}

				savedCount := 0
				updatedCount := 0
				for _, repo := range repos {
					existing, _ := app.Dao().FindFirstRecordByFilter(
						collection.Id,
						"github_user = {:user} && repo_id = {:repoId}",
						map[string]interface{}{"user": username, "repoId": repo.ID},
					)

					record := existing
					if record == nil {
						record = models.NewRecord(collection)
						record.Set("github_user", username)
						record.Set("repo_id", repo.ID)
					} else {
						updatedCount++
					}

					record.Set("repo_name", repo.Name)
					record.Set("full_name", repo.FullName)
					record.Set("description", repo.Description)
					record.Set("html_url", repo.HTMLURL)
					record.Set("star_num", repo.Stargazers)
					record.Set("language", repo.Language)
					record.Set("fork_num", repo.ForksCount)
					record.Set("tags", strings.Join(repo.Topics, ","))
					record.Set("created_at", repo.CreatedAt)
					record.Set("updated_at", repo.UpdatedAt)
					record.Set("pushed_at", repo.PushedAt)
					record.Set("collected_at", time.Now())

					if err := app.Dao().SaveRecord(record); err != nil {
						app.Logger().Error("Failed to save repo", "repo", repo.FullName, "error", err)
					} else {
						savedCount++
					}
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"username": username,
					"fetched":  len(repos),
					"saved":    savedCount,
					"updated":  updatedCount,
					"message":  "Starred repositories collected successfully",
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/starred/search",
			Handler: func(c echo.Context) error {
				githubUser := c.QueryParam("github_user")
				minStars := c.QueryParam("min_stars")
				maxStars := c.QueryParam("max_stars")
				language := c.QueryParam("language")
				tag := c.QueryParam("tag")
				page := c.QueryParam("page")
				perPage := c.QueryParam("perPage")

				if githubUser == "" {
					return apis.NewBadRequestError("github_user parameter is required", nil)
				}

				collection, err := app.Dao().FindCollectionByNameOrId("starred_repos")
				if err != nil {
					return apis.NewBadRequestError("Collection not found", err)
				}

				expr := "github_user = {:user}"
				params := map[string]interface{}{"user": githubUser}

				if minStars != "" {
					if ms, err := strconv.Atoi(minStars); err == nil {
						expr += " && star_num >= {:minStars}"
						params["minStars"] = ms
					}
				}
				if maxStars != "" {
					if ms, err := strconv.Atoi(maxStars); err == nil {
						expr += " && star_num <= {:maxStars}"
						params["maxStars"] = ms
					}
				}
				if language != "" {
					expr += " && language = {:language}"
					params["language"] = language
				}
				if tag != "" {
					expr += " && tags ~ {:tag}"
					params["tag"] = tag
				}

				pageNum := 1
				if page != "" {
					if p, err := strconv.Atoi(page); err == nil && p > 0 {
						pageNum = p
					}
				}

				perPageNum := 30
				if perPage != "" {
					if pp, err := strconv.Atoi(perPage); err == nil && pp > 0 {
						perPageNum = pp
					}
				}

				records, err := app.Dao().FindRecordsByFilter(
					collection.Id,
					expr,
					"-star_num",
					perPageNum,
					(pageNum-1)*perPageNum,
					params,
				)

				if err != nil {
					return apis.NewBadRequestError("Failed to search records", err)
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"page":    pageNum,
					"perPage": perPageNum,
					"items":   records,
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/starred/languages/:username",
			Handler: func(c echo.Context) error {
				username := c.PathParam("username")
				if username == "" {
					return apis.NewBadRequestError("Username is required", nil)
				}

				collection, err := app.Dao().FindCollectionByNameOrId("starred_repos")
				if err != nil {
					return apis.NewBadRequestError("Collection not found", err)
				}

				records, err := app.Dao().FindRecordsByFilter(
					collection.Id,
					"github_user = {:user}",
					"",
					10000,
					0,
					map[string]interface{}{"user": username},
				)

				if err != nil {
					return apis.NewBadRequestError("Failed to fetch records", err)
				}

				languageCount := make(map[string]int)
				for _, record := range records {
					lang := record.GetString("language")
					if lang != "" {
						languageCount[lang]++
					}
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"languages": languageCount,
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/starred/tags/:username",
			Handler: func(c echo.Context) error {
				username := c.PathParam("username")
				if username == "" {
					return apis.NewBadRequestError("Username is required", nil)
				}

				collection, err := app.Dao().FindCollectionByNameOrId("starred_repos")
				if err != nil {
					return apis.NewBadRequestError("Collection not found", err)
				}

				records, err := app.Dao().FindRecordsByFilter(
					collection.Id,
					"github_user = {:user}",
					"",
					10000,
					0,
					map[string]interface{}{"user": username},
				)

				if err != nil {
					return apis.NewBadRequestError("Failed to fetch records", err)
				}

				tagCount := make(map[string]int)
				for _, record := range records {
					tags := record.GetString("tags")
					if tags != "" {
						for _, tag := range strings.Split(tags, ",") {
							tag = strings.TrimSpace(tag)
							if tag != "" {
								tagCount[tag]++
							}
						}
					}
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"tags": tagCount,
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		e.Router.AddRoute(echo.Route{
			Method: http.MethodPost,
			Path:   "/api/github/trending/collect",
			Handler: func(c echo.Context) error {
				period := c.QueryParam("period")
				if period == "" {
					period = "daily"
				}

				if period != "daily" && period != "weekly" && period != "monthly" {
					return apis.NewBadRequestError("Invalid period. Must be daily, weekly, or monthly", nil)
				}

				repos, err := fetchGitHubTrending(period)
				if err != nil {
					return apis.NewBadRequestError("Failed to fetch trending repos", err)
				}

				collection, err := app.Dao().FindCollectionByNameOrId("trending_repos")
				if err != nil {
					return apis.NewBadRequestError("Collection not found", err)
				}

				savedCount := 0
				snapshotDate := time.Now().Format("2006-01-02")

				for _, repo := range repos {
					record := models.NewRecord(collection)
					record.Set("repo_id", 0)
					record.Set("repo_name", repo.Name)
					record.Set("full_name", repo.FullName)
					record.Set("description", repo.Description)
					record.Set("html_url", repo.HTMLURL)
					record.Set("star_num", repo.Stargazers)
					record.Set("language", repo.Language)
					record.Set("fork_num", repo.ForksCount)
					record.Set("tags", strings.Join(repo.Topics, ","))
					record.Set("trending_period", period)
					record.Set("snapshot_date", snapshotDate)
					record.Set("stars_today", repo.StarsToday)
					record.Set("rank", repo.Rank)
					record.Set("collected_at", time.Now())

					if err := app.Dao().SaveRecord(record); err != nil {
						app.Logger().Error("Failed to save trending repo", "repo", repo.FullName, "error", err)
					} else {
						savedCount++
					}
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"period":        period,
					"fetched":       len(repos),
					"saved":         savedCount,
					"snapshot_date": snapshotDate,
					"message":       "Trending repositories collected successfully",
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/trending/search",
			Handler: func(c echo.Context) error {
				period := c.QueryParam("period")
				snapshotDate := c.QueryParam("snapshot_date")
				language := c.QueryParam("language")
				minStars := c.QueryParam("min_stars")
				maxStars := c.QueryParam("max_stars")
				page := c.QueryParam("page")
				perPage := c.QueryParam("perPage")

				if period == "" {
					period = "daily"
				}

				collection, err := app.Dao().FindCollectionByNameOrId("trending_repos")
				if err != nil {
					return apis.NewBadRequestError("Collection not found", err)
				}

				expr := "trending_period = {:period}"
				params := map[string]interface{}{"period": period}

				if snapshotDate != "" {
					expr += " && snapshot_date = {:snapshotDate}"
					params["snapshotDate"] = snapshotDate
				}
				if language != "" {
					expr += " && language = {:language}"
					params["language"] = language
				}
				if minStars != "" {
					if ms, err := strconv.Atoi(minStars); err == nil {
						expr += " && star_num >= {:minStars}"
						params["minStars"] = ms
					}
				}
				if maxStars != "" {
					if ms, err := strconv.Atoi(maxStars); err == nil {
						expr += " && star_num <= {:maxStars}"
						params["maxStars"] = ms
					}
				}

				pageNum := 1
				if page != "" {
					if p, err := strconv.Atoi(page); err == nil && p > 0 {
						pageNum = p
					}
				}

				perPageNum := 30
				if perPage != "" {
					if pp, err := strconv.Atoi(perPage); err == nil && pp > 0 {
						perPageNum = pp
					}
				}

				records, err := app.Dao().FindRecordsByFilter(
					collection.Id,
					expr,
					"rank",
					perPageNum,
					(pageNum-1)*perPageNum,
					params,
				)

				if err != nil {
					return apis.NewBadRequestError("Failed to search records", err)
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"page":    pageNum,
					"perPage": perPageNum,
					"items":   records,
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/trending/dates",
			Handler: func(c echo.Context) error {
				period := c.QueryParam("period")
				if period == "" {
					period = "daily"
				}

				collection, err := app.Dao().FindCollectionByNameOrId("trending_repos")
				if err != nil {
					return apis.NewBadRequestError("Collection not found", err)
				}

				records, err := app.Dao().FindRecordsByFilter(
					collection.Id,
					"trending_period = {:period}",
					"-snapshot_date",
					10000,
					0,
					map[string]interface{}{"period": period},
				)

				if err != nil {
					return apis.NewBadRequestError("Failed to fetch records", err)
				}

				dateSet := make(map[string]bool)
				for _, record := range records {
					date := record.GetString("snapshot_date")
					if date != "" {
						dateSet[date] = true
					}
				}

				dates := make([]string, 0, len(dateSet))
				for date := range dateSet {
					dates = append(dates, date)
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"period": period,
					"dates":  dates,
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/trending/languages",
			Handler: func(c echo.Context) error {
				period := c.QueryParam("period")
				snapshotDate := c.QueryParam("snapshot_date")

				if period == "" {
					period = "daily"
				}

				collection, err := app.Dao().FindCollectionByNameOrId("trending_repos")
				if err != nil {
					return apis.NewBadRequestError("Collection not found", err)
				}

				expr := "trending_period = {:period}"
				params := map[string]interface{}{"period": period}
				if snapshotDate != "" {
					expr += " && snapshot_date = {:snapshotDate}"
					params["snapshotDate"] = snapshotDate
				}

				records, err := app.Dao().FindRecordsByFilter(
					collection.Id,
					expr,
					"",
					10000,
					0,
					params,
				)

				if err != nil {
					return apis.NewBadRequestError("Failed to fetch records", err)
				}

				languageCount := make(map[string]int)
				for _, record := range records {
					lang := record.GetString("language")
					if lang != "" {
						languageCount[lang]++
					}
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"languages": languageCount,
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(app),
			},
		})

		scheduler := cron.New()
		scheduler.MustAdd("collect_starred_repos", "0 0 * * *", func() {
			app.Logger().Info("Starting scheduled collection of starred repos")

			collection, err := app.Dao().FindCollectionByNameOrId("collection_configs")
			if err != nil {
				app.Logger().Error("Failed to find collection_configs", "error", err)
				return
			}

			records, err := app.Dao().FindRecordsByFilter(
				collection.Id,
				"enabled = true",
				"",
				100,
				0,
			)

			if err != nil {
				app.Logger().Error("Failed to fetch collection configs", "error", err)
				return
			}

			for _, record := range records {
				username := record.GetString("github_user")
				app.Logger().Info("Collecting starred repos for user", "username", username)

				repos, err := fetchGitHubStarredRepos(username)
				if err != nil {
					app.Logger().Error("Failed to fetch starred repos", "username", username, "error", err)
					continue
				}

				starredCollection, err := app.Dao().FindCollectionByNameOrId("starred_repos")
				if err != nil {
					app.Logger().Error("Failed to find starred_repos collection", "error", err)
					continue
				}

				for _, repo := range repos {
					existing, _ := app.Dao().FindFirstRecordByFilter(
						starredCollection.Id,
						"github_user = {:user} && repo_id = {:repoId}",
						map[string]interface{}{"user": username, "repoId": repo.ID},
					)

					r := existing
					if r == nil {
						r = models.NewRecord(starredCollection)
						r.Set("github_user", username)
						r.Set("repo_id", repo.ID)
					}

					r.Set("repo_name", repo.Name)
					r.Set("full_name", repo.FullName)
					r.Set("description", repo.Description)
					r.Set("html_url", repo.HTMLURL)
					r.Set("star_num", repo.Stargazers)
					r.Set("language", repo.Language)
					r.Set("fork_num", repo.ForksCount)
					r.Set("tags", strings.Join(repo.Topics, ","))
					r.Set("created_at", repo.CreatedAt)
					r.Set("updated_at", repo.UpdatedAt)
					r.Set("pushed_at", repo.PushedAt)
					r.Set("collected_at", time.Now())

					if err := app.Dao().SaveRecord(r); err != nil {
						app.Logger().Error("Failed to save repo", "repo", repo.FullName, "error", err)
					}
				}

				app.Logger().Info("Collected starred repos", "username", username, "count", len(repos))
			}
		})

		scheduler.MustAdd("collect_trending_repos", "0 1 * * *", func() {
			app.Logger().Info("Starting scheduled collection of trending repos")

			periods := []string{"daily", "weekly", "monthly"}
			for _, period := range periods {
				app.Logger().Info("Collecting trending repos", "period", period)

				repos, err := fetchGitHubTrending(period)
				if err != nil {
					app.Logger().Error("Failed to fetch trending repos", "period", period, "error", err)
					continue
				}

				collection, err := app.Dao().FindCollectionByNameOrId("trending_repos")
				if err != nil {
					app.Logger().Error("Failed to find trending_repos collection", "error", err)
					continue
				}

				snapshotDate := time.Now().Format("2006-01-02")

				for _, repo := range repos {
					record := models.NewRecord(collection)
					record.Set("repo_id", 0)
					record.Set("repo_name", repo.Name)
					record.Set("full_name", repo.FullName)
					record.Set("description", repo.Description)
					record.Set("html_url", repo.HTMLURL)
					record.Set("star_num", repo.Stargazers)
					record.Set("language", repo.Language)
					record.Set("fork_num", repo.ForksCount)
					record.Set("tags", strings.Join(repo.Topics, ","))
					record.Set("trending_period", period)
					record.Set("snapshot_date", snapshotDate)
					record.Set("stars_today", repo.StarsToday)
					record.Set("rank", repo.Rank)
					record.Set("collected_at", time.Now())

					if err := app.Dao().SaveRecord(record); err != nil {
						app.Logger().Error("Failed to save trending repo", "repo", repo.FullName, "error", err)
					}
				}

				app.Logger().Info("Collected trending repos", "period", period, "count", len(repos))
			}
		})
		scheduler.Start()

		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func ensureCollections(app *pocketbase.PocketBase) error {
	dao := app.Dao()

	collections := []struct {
		name   string
		schema []*schema.SchemaField
		indexes []string
		rules  func() *string
	}{
		{
			name: "starred_repos",
			schema: []*schema.SchemaField{
				{Name: "github_user", Type: schema.FieldTypeText, Required: true},
				{Name: "repo_id", Type: schema.FieldTypeNumber, Required: true, Unique: true},
				{Name: "repo_name", Type: schema.FieldTypeText, Required: true},
				{Name: "full_name", Type: schema.FieldTypeText, Required: true},
				{Name: "description", Type: schema.FieldTypeText},
				{Name: "html_url", Type: schema.FieldTypeUrl, Required: true},
				{Name: "star_num", Type: schema.FieldTypeNumber, Required: true},
				{Name: "language", Type: schema.FieldTypeText},
				{Name: "fork_num", Type: schema.FieldTypeNumber, Required: true},
				{Name: "tags", Type: schema.FieldTypeText},
				{Name: "created_at", Type: schema.FieldTypeDate},
				{Name: "updated_at", Type: schema.FieldTypeDate},
				{Name: "pushed_at", Type: schema.FieldTypeDate},
				{Name: "collected_at", Type: schema.FieldTypeDate, Required: true},
			},
			indexes: []string{
				"CREATE INDEX idx_starred_github_user ON starred_repos (github_user)",
				"CREATE INDEX idx_starred_repo_id ON starred_repos (repo_id)",
				"CREATE INDEX idx_starred_star_num ON starred_repos (star_num)",
				"CREATE INDEX idx_starred_language ON starred_repos (language)",
			},
		},
		{
			name: "collection_configs",
			schema: []*schema.SchemaField{
				{Name: "github_user", Type: schema.FieldTypeText, Required: true},
				{Name: "enabled", Type: schema.FieldTypeBool},
				{Name: "schedule", Type: schema.FieldTypeText},
				{Name: "last_collected", Type: schema.FieldTypeDate},
			},
		},
		{
			name: "trending_repos",
			schema: []*schema.SchemaField{
				{Name: "repo_id", Type: schema.FieldTypeNumber},
				{Name: "repo_name", Type: schema.FieldTypeText, Required: true},
				{Name: "full_name", Type: schema.FieldTypeText, Required: true},
				{Name: "description", Type: schema.FieldTypeText},
				{Name: "html_url", Type: schema.FieldTypeUrl, Required: true},
				{Name: "star_num", Type: schema.FieldTypeNumber, Required: true},
				{Name: "language", Type: schema.FieldTypeText},
				{Name: "fork_num", Type: schema.FieldTypeNumber},
				{Name: "tags", Type: schema.FieldTypeText},
				{Name: "trending_period", Type: schema.FieldTypeSelect, Required: true,
					Options: &schema.SelectOptions{MaxSelect: 1, Values: []string{"daily", "weekly", "monthly"}}},
				{Name: "snapshot_date", Type: schema.FieldTypeText, Required: true},
				{Name: "stars_today", Type: schema.FieldTypeNumber},
				{Name: "rank", Type: schema.FieldTypeNumber},
				{Name: "collected_at", Type: schema.FieldTypeDate, Required: true},
			},
			indexes: []string{
				"CREATE INDEX idx_trending_period ON trending_repos (trending_period)",
				"CREATE INDEX idx_trending_snapshot ON trending_repos (snapshot_date)",
			},
		},
	}

	for _, c := range collections {
		existing, _ := dao.FindCollectionByNameOrId(c.name)
		if existing != nil {
			continue
		}

		collection := &models.Collection{
			Name: c.name,
			Type: models.CollectionTypeBase,
			Schema: schema.NewSchema(c.schema...),
		}

		collection.MarkAsNew()
		if len(c.indexes) > 0 {
			collection.Indexes = c.indexes
		}

		emptyStr := ""
		collection.ListRule = &emptyStr
		collection.ViewRule = &emptyStr
		collection.CreateRule = &emptyStr
		collection.UpdateRule = &emptyStr
		collection.DeleteRule = &emptyStr

		if err := daos.New(dao.DB()).SaveCollection(collection); err != nil {
			return fmt.Errorf("failed to create collection %s: %w", c.name, err)
		}
		app.Logger().Info("Created collection", "name", c.name)
	}

	return nil
}

func fetchGitHubStarredRepos(username string) ([]GitHubRepo, error) {
	var allRepos []GitHubRepo
	page := 1
	perPage := 100

	client := &http.Client{Timeout: 30 * time.Second}
	token := os.Getenv("GITHUB_TOKEN")

	for {
		url := fmt.Sprintf("https://api.github.com/users/%s/starred?per_page=%d&page=%d", username, perPage, page)

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Accept", "application/vnd.github.v3+json")
		req.Header.Set("User-Agent", "GitHub-Starred-Collector")

		if token != "" {
			req.Header.Set("Authorization", fmt.Sprintf("token %s", token))
		}

		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("GitHub API error: %s - %s", resp.Status, string(body))
		}

		var repos []GitHubRepo
		if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()

		if len(repos) == 0 {
			break
		}

		allRepos = append(allRepos, repos...)

		if len(repos) < perPage {
			break
		}

		page++
	}

	return allRepos, nil
}

func fetchGitHubTrending(period string) ([]TrendingRepo, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	url := fmt.Sprintf("https://github.com/trending?since=%s", period)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub trending page error: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return parseTrendingHTML(string(body), period)
}

func parseTrendingHTML(html string, period string) ([]TrendingRepo, error) {
	var repos []TrendingRepo

	repoRegex := regexp.MustCompile(`<h2[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>.*?</h2>`)
	descRegex := regexp.MustCompile(`<p[^>]*class="col-9[^"]*"[^>]*>([^<]+)</p>`)
	langRegex := regexp.MustCompile(`<span[^>]*itemprop="programmingLanguage"[^>]*>([^<]+)</span>`)
	starRegex := regexp.MustCompile(`<a[^>]*href="[^"]*/stargazers"[^>]*>\s*([0-9,]+)\s*</a>`)
	forkRegex := regexp.MustCompile(`<a[^>]*href="[^"]*/forks"[^>]*>\s*([0-9,]+)\s*</a>`)
	starsTodayRegex := regexp.MustCompile(`([0-9,]+)\s*stars\s*(?:today|this week|this month)`)
	topicRegex := regexp.MustCompile(`<a[^>]*class="topic-tag"[^>]*>([^<]+)</a>`)

	repoMatches := repoRegex.FindAllStringSubmatch(html, -1)

	for i, match := range repoMatches {
		if len(match) < 3 {
			continue
		}

		repoPath := strings.TrimSpace(match[1])
		repoName := strings.TrimSpace(match[2])
		fullName := strings.TrimPrefix(repoPath, "/")

		startMatch := match[0]
		endIdx := len(html)
		if i < len(repoMatches)-1 {
			nextMatch := repoMatches[i+1][0]
			endIdx = strings.Index(html, nextMatch)
			if endIdx == -1 {
				endIdx = len(html)
			}
		}

		startIdx := strings.Index(html, startMatch)
		if startIdx == -1 {
			continue
		}
		repoHTML := html[startIdx:endIdx]

		description := ""
		if descMatch := descRegex.FindStringSubmatch(repoHTML); len(descMatch) > 1 {
			description = strings.TrimSpace(descMatch[1])
		}

		language := ""
		if langMatch := langRegex.FindStringSubmatch(repoHTML); len(langMatch) > 1 {
			language = strings.TrimSpace(langMatch[1])
		}

		stars := 0
		if starMatch := starRegex.FindStringSubmatch(repoHTML); len(starMatch) > 1 {
			starStr := strings.ReplaceAll(strings.TrimSpace(starMatch[1]), ",", "")
			stars, _ = strconv.Atoi(starStr)
		}

		forks := 0
		if forkMatch := forkRegex.FindStringSubmatch(repoHTML); len(forkMatch) > 1 {
			forkStr := strings.ReplaceAll(strings.TrimSpace(forkMatch[1]), ",", "")
			forks, _ = strconv.Atoi(forkStr)
		}

		starsToday := 0
		if starsTodayMatch := starsTodayRegex.FindStringSubmatch(repoHTML); len(starsTodayMatch) > 1 {
			starsTodayStr := strings.ReplaceAll(strings.TrimSpace(starsTodayMatch[1]), ",", "")
			starsToday, _ = strconv.Atoi(starsTodayStr)
		}

		var topics []string
		topicMatches := topicRegex.FindAllStringSubmatch(repoHTML, -1)
		for _, topicMatch := range topicMatches {
			if len(topicMatch) > 1 {
				topics = append(topics, strings.TrimSpace(topicMatch[1]))
			}
		}

		repo := TrendingRepo{
			Name:           repoName,
			FullName:       fullName,
			Description:    description,
			HTMLURL:        fmt.Sprintf("https://github.com%s", repoPath),
			Stargazers:     stars,
			Language:       language,
			ForksCount:     forks,
			Topics:         topics,
			StarsToday:     starsToday,
			TrendingPeriod: period,
			Rank:           i + 1,
		}

		repos = append(repos, repo)
	}

	return repos, nil
}
