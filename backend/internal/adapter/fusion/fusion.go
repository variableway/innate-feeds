// Package fusion provides an adapter that pulls items from a remote Fusion
// instance via its Fever API.
//
// Fusion's /fever endpoint returns the same JSON shape as any other Fever
// client: authentication, feeds, items, groups. We use that to populate
// innate-hub's local items table without ever touching the remote DB.
//
// The api_key is MD5(username:password) — the same algorithm Fusion itself
// uses (see innate-hub/backend/internal/handler/fever.go). It is computed
// once at construction and reused.
package fusion

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/innate/hub/internal/adapter"
	"github.com/innate/hub/internal/model"
)

type Adapter struct {
	baseURL  string
	username string
	password string
	apiKey   string

	// httpClient is reused across calls; the timeout is applied per-request
	// by the puller via context, not by the client.
	httpClient *http.Client

	// mu protects the lazy login state below. The first Pull() logs in and
	// caches the auth cookie. Subsequent calls skip the login.
	mu        sync.Mutex
	authedAt  time.Time
	authFresh time.Duration
}

// New returns a Fusion adapter that talks to the given remote base URL.
// username and password are the Fever credentials, not the web login.
func New(baseURL, username, password string) *Adapter {
	apiKey := deriveFeverAPIKey(username, password)
	return &Adapter{
		baseURL:    strings.TrimRight(baseURL, "/"),
		username:   username,
		password:   password,
		apiKey:     apiKey,
		httpClient: &http.Client{},
		authFresh:  30 * time.Minute,
	}
}

func (a *Adapter) Name() string { return "fusion" }

func deriveFeverAPIKey(username, password string) string {
	sum := md5.Sum([]byte(strings.TrimSpace(username) + ":" + password))
	return hex.EncodeToString(sum[:])
}

// feverResponse is the relevant subset of /fever's JSON reply.
type feverResponse struct {
	Auth          int            `json:"auth"`
	LastRefreshed int64          `json:"last_refreshed_on_time"`
	Feeds         []feverFeed    `json:"feeds"`
	Items         []feverItem    `json:"items"`
	TotalItems    int            `json:"total_items"`
}

type feverFeed struct {
	ID                int64  `json:"id"`
	FaviconID         int64  `json:"favicon_id"`
	Title             string `json:"title"`
	URL               string `json:"url"`
	SiteURL           string `json:"site_url"`
	IsSpark           int    `json:"is_spark"`
	LastUpdatedOnTime int64  `json:"last_updated_on_time"`
}

type feverItem struct {
	ID            int64  `json:"id"`
	FeedID        int64  `json:"feed_id"`
	Title         string `json:"title"`
	Author        string `json:"author"`
	HTML          string `json:"html"`
	URL           string `json:"url"`
	IsSaved       int    `json:"is_saved"`
	IsRead        int    `json:"is_read"`
	CreatedOnTime int64  `json:"created_on_time"`
}

// Pull fetches all items from the remote Fusion and returns them as
// adapter.Result items. GUIDs are stable per (feed_id, item_id) so
// re-imports dedupe at the store level.
func (a *Adapter) Pull(ctx context.Context, feed *model.Feed, timeout time.Duration) (*adapter.Result, error) {
	_ = feed // unused: we pull from the whole source, not one feed

	if err := a.ensureAuth(ctx, timeout); err != nil {
		return nil, fmt.Errorf("fusion auth: %w", err)
	}

	// Request items. We do not filter by feed_id because the Fusion instance
	// can hold many feeds; the caller is expected to attach one fusion
	// adapter per remote source. If the feed.Link carries a feed_id, we
	// filter to that one.
	targetFeedID := int64(0)
	if feed != nil {
		targetFeedID = parseFeedIDFromLink(feed.Link)
	}

	resp, err := a.feverCall(ctx, timeout, map[string]string{
		"feeds": "",
		"items": "",
	})
	if err != nil {
		return nil, err
	}
	if resp.Auth != 1 {
		// Force re-auth next time.
		a.mu.Lock()
		a.authedAt = time.Time{}
		a.mu.Unlock()
		return nil, fmt.Errorf("fusion /fever returned auth=0")
	}

	// Build a small feed-id → site_url/title lookup for enrichment.
	feedSite := make(map[int64]string, len(resp.Feeds))
	feedTitle := make(map[int64]string, len(resp.Feeds))
	for _, f := range resp.Feeds {
		feedSite[f.ID] = f.SiteURL
		feedTitle[f.ID] = f.Title
	}

	items := make([]model.Item, 0, len(resp.Items))
	for _, it := range resp.Items {
		if targetFeedID != 0 && it.FeedID != targetFeedID {
			continue
		}
		// Stable GUID: encode the remote (feed_id, item_id) so re-imports dedupe.
		guid := fmt.Sprintf("fusion:%d:%d", it.FeedID, it.ID)

		// Link preference: remote URL if set, else the site URL.
		link := strings.TrimSpace(it.URL)
		if link == "" {
			link = feedSite[it.FeedID]
		}
		if link == "" {
			link = feedTitle[it.FeedID]
		}

		items = append(items, model.Item{
			GUID:    guid,
			Title:   strings.TrimSpace(it.Title),
			Link:    link,
			Content: it.HTML,
			PubDate: it.CreatedOnTime,
		})
	}

	return &adapter.Result{
		Items:       items,
		SiteURL:     "",
		NotModified: false,
		HTTPStatus:  0,
	}, nil
}

func (a *Adapter) ensureAuth(ctx context.Context, timeout time.Duration) error {
	a.mu.Lock()
	if !a.authedAt.IsZero() && time.Since(a.authedAt) < a.authFresh {
		a.mu.Unlock()
		return nil
	}
	a.mu.Unlock()

	form := url.Values{"api": {"1"}, "api_key": {a.apiKey}}
	resp, err := a.postForm(ctx, timeout, "", form)
	if err != nil {
		return err
	}
	if resp.Auth != 1 {
		return fmt.Errorf("auth=0 for user %q (check FUSION_SOURCES_JSON credentials)", a.username)
	}
	a.mu.Lock()
	a.authedAt = time.Now()
	a.mu.Unlock()
	return nil
}

func (a *Adapter) feverCall(ctx context.Context, timeout time.Duration, extra map[string]string) (*feverResponse, error) {
	form := url.Values{"api": {"1"}, "api_key": {a.apiKey}}
	for k, v := range extra {
		form.Set(k, v)
	}
	return a.postForm(ctx, timeout, "", form)
}

func (a *Adapter) postForm(ctx context.Context, timeout time.Duration, path string, form url.Values) (*feverResponse, error) {
	target := a.baseURL
	if path != "" {
		target += path
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "innate-hub-fusion-adapter/1.0")

	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
		req = req.WithContext(ctx)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("fusion HTTP %d: %s", resp.StatusCode, string(body))
	}

	var out feverResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode fever response: %w", err)
	}
	return &out, nil
}

// parseFeedIDFromLink looks for "feed=N" or "feed_id=N" or a trailing "/N" in the
// link string. Returns 0 when no feed-id filter is present.
func parseFeedIDFromLink(link string) int64 {
	link = strings.TrimSpace(link)
	if link == "" {
		return 0
	}
	// "feed=12"
	if i := strings.Index(link, "feed="); i >= 0 {
		rest := link[i+len("feed="):]
		rest = strings.TrimFunc(rest, func(r rune) bool { return r < '0' || r > '9' })
		var n int64
		for _, c := range rest {
			if c < '0' || c > '9' {
				break
			}
			n = n*10 + int64(c-'0')
		}
		return n
	}
	// trailing "/N" on the URL
	if i := strings.LastIndex(link, "/"); i >= 0 {
		rest := link[i+1:]
		var n int64
		for _, c := range rest {
			if c < '0' || c > '9' {
				return 0
			}
			n = n*10 + int64(c-'0')
		}
		return n
	}
	return 0
}
