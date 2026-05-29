// Package trendradar provides an adapter that reads hot-news data from
// TrendRadar's daily SQLite databases.
//
// TrendRadar stores crawled news in output/news/YYYY-MM-DD.db with tables:
//   - platforms (id, name)
//   - news_items (title, platform_id, rank, url, first_crawl_time, last_crawl_time)
//   - rank_history (news_item_id, rank, crawl_time)
//
// This adapter scans the newest database file, reads news_items joined with
// platforms, and returns them as adapter.Result items so they flow into the
// same items table as RSS articles.
package trendradar

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/innate/hub/internal/adapter"
	"github.com/innate/hub/internal/model"
	_ "modernc.org/sqlite"
)

type TrendRadarAdapter struct {
	dataDir string // e.g. "TrendRadar/output/news"
}

func New(dataDir string) *TrendRadarAdapter {
	return &TrendRadarAdapter{dataDir: dataDir}
}

func (a *TrendRadarAdapter) Name() string {
	return "trendradar"
}

// Pull reads the latest TrendRadar SQLite database and returns all news items
// as adapter results. The feed.Link field is expected to contain the data
// directory path (overrides the constructor default if non-empty).
func (a *TrendRadarAdapter) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*adapter.Result, error) {
	dir := a.dataDir
	if strings.TrimSpace(feed.Link) != "" {
		dir = feed.Link
	}

	dbPath, err := findLatestDB(dir)
	if err != nil {
		return nil, fmt.Errorf("find latest trendradar db: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath+"?_journal=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open trendradar db: %w", err)
	}
	defer db.Close()

	rows, err := db.QueryContext(ctx, `
		SELECT
			n.title,
			n.platform_id,
			p.name as platform_name,
			n.rank,
			n.url,
			n.mobile_url,
			n.first_crawl_time,
			n.last_crawl_time
		FROM news_items n
		JOIN platforms p ON n.platform_id = p.id
		ORDER BY n.last_crawl_time DESC, n.rank ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query news_items: %w", err)
	}
	defer rows.Close()

	items := make([]model.Item, 0, 256)
	now := time.Now().Unix()

	for rows.Next() {
		var title, platformID, platformName string
		var rank int
		var url, mobileURL, firstCrawl, lastCrawl string

		if err := rows.Scan(&title, &platformID, &platformName, &rank, &url, &mobileURL, &firstCrawl, &lastCrawl); err != nil {
			continue
		}

		// Build a stable GUID from platform + title so re-imports de-dupe.
		guid := fmt.Sprintf("trendradar:%s:%s", platformID, title)

		// Parse last_crawl_time as pub_date (best approximation).
		pubDate := parseCrawlTime(lastCrawl, now)

		// Use mobile_url if present, fallback to url.
		link := mobileURL
		if strings.TrimSpace(link) == "" {
			link = url
		}

		content := fmt.Sprintf("Rank: #%d | Platform: %s", rank, platformName)

		items = append(items, model.Item{
			GUID:    guid,
			Title:   title,
			Link:    link,
			Content: content,
			PubDate: pubDate,
		})
	}

	return &adapter.Result{
		Items:       items,
		SiteURL:     "",
		NotModified: false,
		HTTPStatus:  0,
	}, nil
}

// findLatestDB finds the most recent .db file in the given directory.
func findLatestDB(dir string) (string, error) {
	matches, err := filepath.Glob(filepath.Join(dir, "*.db"))
	if err != nil {
		return "", err
	}
	if len(matches) == 0 {
		return "", fmt.Errorf("no .db files found in %s", dir)
	}

	// Sort descending by filename (YYYY-MM-DD.db); latest date is last alphabetically.
	sort.Strings(matches)
	return matches[len(matches)-1], nil
}

// parseCrawlTime parses TrendRadar's crawl time string.
// TrendRadar stores crawl_time as "YYYY-MM-DD HH:MM" or similar.
func parseCrawlTime(s string, fallback int64) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return fallback
	}

	layouts := []string{
		"2006-01-02 15:04",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Unix()
		}
	}

	return fallback
}
