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
	"github.com/pocketbase/pocketbase/models"
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
				for _, repo := range repos {
					record := models.NewRecord(collection)
					record.Set("github_user", username)
					record.Set("repo_id", repo.ID)
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

				expr := fmt.Sprintf("github_user = '%s'", githubUser)

				if minStars != "" {
					expr += fmt.Sprintf(" && star_num >= %s", minStars)
				}
				if maxStars != "" {
					expr += fmt.Sprintf(" && star_num <= %s", maxStars)
				}
				if language != "" {
					expr += fmt.Sprintf(" && language = '%s'", language)
				}
				if tag != "" {
					expr += fmt.Sprintf(" && tags ~ '%s'", tag)
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
					pageNum,
					perPageNum,
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
					fmt.Sprintf("github_user = '%s'", username),
					"",
					1,
					10000,
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
					fmt.Sprintf("github_user = '%s'", username),
					"",
					1,
					10000,
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

				expr := fmt.Sprintf("trending_period = '%s'", period)

				if snapshotDate != "" {
					expr += fmt.Sprintf(" && snapshot_date = '%s'", snapshotDate)
				}
				if language != "" {
					expr += fmt.Sprintf(" && language = '%s'", language)
				}
				if minStars != "" {
					expr += fmt.Sprintf(" && star_num >= %s", minStars)
				}
				if maxStars != "" {
					expr += fmt.Sprintf(" && star_num <= %s", maxStars)
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
					pageNum,
					perPageNum,
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
					fmt.Sprintf("trending_period = '%s'", period),
					"-snapshot_date",
					1,
					10000,
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

				expr := fmt.Sprintf("trending_period = '%s'", period)
				if snapshotDate != "" {
					expr += fmt.Sprintf(" && snapshot_date = '%s'", snapshotDate)
				}

				records, err := app.Dao().FindRecordsByFilter(
					collection.Id,
					expr,
					"",
					1,
					10000,
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
				1,
				100,
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
					record := models.NewRecord(starredCollection)
					record.Set("github_user", username)
					record.Set("repo_id", repo.ID)
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
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("GitHub API error: %s - %s", resp.Status, string(body))
		}

		var repos []GitHubRepo
		if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
			return nil, err
		}

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

	var since string
	switch period {
	case "daily":
		since = "daily"
	case "weekly":
		since = "weekly"
	case "monthly":
		since = "monthly"
	default:
		since = "daily"
	}

	url := fmt.Sprintf("https://github.com/trending?since=%s", since)

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

		startIdx := match[0]
		endIdx := 0
		if i < len(repoMatches)-1 {
			endIdx = repoMatches[i+1][0]
		} else {
			endIdx = len(html)
		}

		repoHTML := html[strings.Index(html, startIdx):endIdx]

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
