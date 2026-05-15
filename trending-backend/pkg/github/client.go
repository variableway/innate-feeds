package github

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/go-resty/resty/v2"
)

// TrendingRepo represents a single trending repository.
type TrendingRepo struct {
	Owner       string
	Name        string
	FullName    string
	Description string
	Language    string
	Stars       int
	StarsToday  int
	Forks       int
	URL         string
}

// StarredRepo represents a starred repository from the GitHub API.
type StarredRepo struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	FullName    string    `json:"full_name"`
	Description string    `json:"description"`
	Language    string    `json:"language"`
	Stars       int       `json:"stargazers_count"`
	Forks       int       `json:"forks_count"`
	Topics      []string  `json:"topics"`
	HTMLURL     string    `json:"html_url"`
	Private     bool      `json:"private"`
	StarredAt   time.Time `json:"starred_at"`
	Owner       struct {
		Login string `json:"login"`
	} `json:"owner"`
}

// Client wraps interactions with the GitHub API and web scraping.
type Client struct {
	resty   *resty.Client
	baseURL string
	token   string
}

// NewClient creates a new GitHub client.
func NewClient(token, baseURL string) *Client {
	if baseURL == "" {
		baseURL = "https://api.github.com"
	}
	client := resty.New()
	client.SetBaseURL(baseURL)
	client.SetTimeout(30 * time.Second)
	client.SetHeader("Accept", "application/vnd.github.v3+json")
	client.SetHeader("User-Agent", "trending-aggregator/1.0")

	if token != "" {
		client.SetHeader("Authorization", "token "+token)
	}

	return &Client{
		resty:   client,
		baseURL: baseURL,
		token:   token,
	}
}

// GetTrending scrapes GitHub's trending page for the given period and language.
func (c *Client) GetTrending(ctx context.Context, period, language string, count int) ([]TrendingRepo, error) {
	url := "https://github.com/trending"
	if language != "" {
		url += "/" + language
	}

	periodMap := map[string]string{
		"daily":   "daily",
		"weekly":  "weekly",
		"monthly": "monthly",
	}
	since, ok := periodMap[period]
	if !ok {
		since = "daily"
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	q := req.URL.Query()
	q.Set("since", since)
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Accept", "text/html")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching trending page: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("parsing HTML: %w", err)
	}

	var repos []TrendingRepo
	doc.Find("article.Box-row").Each(func(i int, s *goquery.Selection) {
		if count > 0 && i >= count {
			return
		}

		linkElem := s.Find("h2 a")
		href, _ := linkElem.Attr("href")
		fullName := strings.TrimSpace(strings.Join(strings.Fields(linkElem.Text()), ""))
		parts := strings.SplitN(fullName, "/", 2)

		var owner, name string
		if len(parts) == 2 {
			owner = parts[0]
			name = parts[1]
		} else {
			owner = fullName
			name = fullName
		}

		desc := strings.TrimSpace(s.Find("p.col-9").Text())
		lang := strings.TrimSpace(s.Find("[itemprop='programmingLanguage']").Text())

		starsText := s.Find("a[href$='/stargazers']").Text()
		stars := parseCount(starsText)

		forksText := s.Find("a[href$='/forks']").Text()
		forks := parseCount(forksText)

		// Parse "X stars today" text
		starsToday := 0
		s.Find("span.d-inline-block.float-sm-right").Each(func(_ int, sel *goquery.Selection) {
			text := strings.TrimSpace(sel.Text())
			re := regexp.MustCompile(`([\d,]+)\s+stars?\s+today`)
			if matches := re.FindStringSubmatch(text); len(matches) > 1 {
				starsToday = parseCount(matches[1])
			}
		})

		repoURL := "https://github.com" + href
		if href == "" {
			repoURL = "https://github.com/" + fullName
		}

		repos = append(repos, TrendingRepo{
			Owner:       owner,
			Name:        name,
			FullName:    fullName,
			Description: desc,
			Language:    lang,
			Stars:       stars,
			StarsToday:  starsToday,
			Forks:       forks,
			URL:         repoURL,
		})
	})

	slog.Info("fetched GitHub trending", "count", len(repos), "period", period, "language", language)
	return repos, nil
}

// GetUserStarred fetches starred repositories for a given username via the GitHub API.
func (c *Client) GetUserStarred(ctx context.Context, username string, count int) ([]StarredRepo, error) {
	if count <= 0 {
		count = 100
	}

	var allRepos []StarredRepo
	page := 1
	perPage := 100

	for len(allRepos) < count {
		var pageRepos []StarredRepo
		resp, err := c.resty.R().
			SetContext(ctx).
			SetPathParams(map[string]string{
				"username": username,
			}).
			SetQueryParams(map[string]string{
				"per_page": strconv.Itoa(perPage),
				"page":     strconv.Itoa(page),
			}).
			SetResult(&pageRepos).
			Get("/users/{username}/starred")

		if err != nil {
			return nil, fmt.Errorf("fetching starred repos page %d: %w", page, err)
		}

		if resp.StatusCode() != http.StatusOK {
			return nil, fmt.Errorf("unexpected status %d for page %d: %s", resp.StatusCode(), page, resp.String())
		}

		if err := json.Unmarshal(resp.Body(), &pageRepos); err != nil {
			return nil, fmt.Errorf("unmarshaling page %d: %w", page, err)
		}

		if len(pageRepos) == 0 {
			break
		}

		allRepos = append(allRepos, pageRepos...)
		page++
	}

	if len(allRepos) > count {
		allRepos = allRepos[:count]
	}

	slog.Info("fetched GitHub starred", "username", username, "count", len(allRepos))
	return allRepos, nil
}

func parseCount(s string) int {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, "k", "000")
	s = strings.ReplaceAll(s, "K", "000")
	s = strings.ReplaceAll(s, "m", "000000")
	s = strings.ReplaceAll(s, "M", "000000")

	n, _ := strconv.Atoi(s)
	return n
}
