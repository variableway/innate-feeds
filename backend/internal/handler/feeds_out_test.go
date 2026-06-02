package handler

import (
	"context"
	"crypto/tls"
	"encoding/xml"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/innate/hub/internal/config"
	"github.com/innate/hub/internal/store"
)

type tlsConnectionState = tls.ConnectionState

type feedsOutTestPuller struct{}

func (feedsOutTestPuller) RefreshFeed(context.Context, int64) error { return nil }
func (feedsOutTestPuller) RefreshAll(context.Context) (int, error)  { return 0, nil }

func newFeedsOutTestHandler(t *testing.T) (*Handler, *store.Store) {
	t.Helper()

	st, err := store.New(":memory:")
	if err != nil {
		t.Fatalf("new store: %v", err)
	}

	cfg := &config.Config{
		Password:      "secret",
		FeverUsername: "fusion",
		PullTimeout:   30,
		PublicURL:     "https://hub.example.com",
	}

	h, err := New(st, nil, cfg, nil, feedsOutTestPuller{})
	if err != nil {
		_ = st.Close()
		t.Fatalf("new handler: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return h, st
}

func seedFeedAndItems(t *testing.T, st *store.Store) (int64, int64) {
	t.Helper()

	// The migration seeds a "Default" group with id=1. Reuse it.
	feed, err := st.CreateFeed(1, "Example Feed", "https://example.com/feed.xml", "https://example.com", "")
	if err != nil {
		t.Fatalf("create feed: %v", err)
	}
	inputs := []store.BatchCreateItemInput{
		{
			GUID:    "https://example.com/post/1",
			Title:   "First post",
			Link:    "https://example.com/post/1",
			Content: "<p>Hello world</p>",
			PubDate: 1717228800, // 2024-06-01
		},
		{
			GUID:    "https://example.com/post/2",
			Title:   "Second post",
			Link:    "https://example.com/post/2",
			Content: "<p>Second body</p>",
			PubDate: 1717315200, // 2024-06-02
		},
	}
	if _, err := st.BatchCreateItemsIgnore(feed.ID, inputs); err != nil {
		t.Fatalf("batch create items: %v", err)
	}
	return feed.ID, 1
}

func TestFeedRSS_OK(t *testing.T) {
	h, st := newFeedsOutTestHandler(t)
	feedID, _ := seedFeedAndItems(t, st)
	r := h.SetupRouter()

	w := performRequest(r, http.MethodGet, "/feeds/"+itoa(feedID)+"/rss.xml", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/rss+xml") {
		t.Errorf("Content-Type = %q", got)
	}
	if got := w.Header().Get("Cache-Control"); got != "public, max-age=60" {
		t.Errorf("Cache-Control = %q", got)
	}
	if w.Header().Get("ETag") == "" {
		t.Errorf("ETag missing")
	}
	body := w.Body.String()
	if !strings.Contains(body, "<rss") {
		t.Errorf("missing <rss> root:\n%s", body)
	}
	if !strings.Contains(body, "First post") {
		t.Errorf("missing first item title:\n%s", body)
	}
	type rssCheck struct {
		Channel struct {
			Title string `xml:"title"`
			Items []struct {
				Title string `xml:"title"`
			} `xml:"item"`
		} `xml:"channel"`
	}
	var parsed rssCheck
	if err := xml.Unmarshal([]byte(body), &parsed); err != nil {
		t.Fatalf("xml parse: %v\n%s", err, body)
	}
	if len(parsed.Channel.Items) != 2 {
		t.Errorf("items = %d, want 2", len(parsed.Channel.Items))
	}
}

func TestFeedAtom_OK(t *testing.T) {
	h, st := newFeedsOutTestHandler(t)
	feedID, _ := seedFeedAndItems(t, st)
	r := h.SetupRouter()

	w := performRequest(r, http.MethodGet, "/feeds/"+itoa(feedID)+"/atom.xml", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, "<feed") {
		t.Errorf("missing <feed>")
	}
	if !strings.Contains(body, "First post") {
		t.Errorf("missing item")
	}
}

func TestFeedJSON_OK(t *testing.T) {
	h, st := newFeedsOutTestHandler(t)
	feedID, _ := seedFeedAndItems(t, st)
	r := h.SetupRouter()

	w := performRequest(r, http.MethodGet, "/feeds/"+itoa(feedID)+"/feed.json", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/feed+json") {
		t.Errorf("Content-Type = %q", got)
	}
	body := w.Body.String()
	if !strings.Contains(body, `"items"`) {
		t.Errorf("missing items array")
	}
	if !strings.Contains(body, "First post") {
		t.Errorf("missing first item")
	}
}

func TestFeedRSS_Unauthenticated(t *testing.T) {
	// The feed output endpoints are intentionally public.
	h, st := newFeedsOutTestHandler(t)
	feedID, _ := seedFeedAndItems(t, st)
	r := h.SetupRouter()

	w := performRequest(r, http.MethodGet, "/feeds/"+itoa(feedID)+"/rss.xml", nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 (public endpoint), got %d", w.Code)
	}
}

func TestFeedRSS_NotFound(t *testing.T) {
	h, _ := newFeedsOutTestHandler(t)
	r := h.SetupRouter()
	w := performRequest(r, http.MethodGet, "/feeds/9999/rss.xml", nil, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestFeedRSS_ETagNotModified(t *testing.T) {
	h, st := newFeedsOutTestHandler(t)
	feedID, _ := seedFeedAndItems(t, st)
	r := h.SetupRouter()

	w1 := performRequest(r, http.MethodGet, "/feeds/"+itoa(feedID)+"/rss.xml", nil, nil)
	if w1.Code != http.StatusOK {
		t.Fatalf("first status = %d", w1.Code)
	}
	etag := w1.Header().Get("ETag")
	if etag == "" {
		t.Fatalf("ETag empty")
	}

	w2 := performRequest(r, http.MethodGet, "/feeds/"+itoa(feedID)+"/rss.xml", nil, map[string]string{
		"If-None-Match": etag,
	})
	if w2.Code != http.StatusNotModified {
		t.Errorf("expected 304, got %d, body=%s", w2.Code, w2.Body.String())
	}
}

func TestAllFeedRSS(t *testing.T) {
	h, st := newFeedsOutTestHandler(t)
	_, _ = seedFeedAndItems(t, st)
	r := h.SetupRouter()

	w := performRequest(r, http.MethodGet, "/all/rss.xml", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "First post") {
		t.Errorf("missing item in /all/rss.xml")
	}
}

func TestGroupFeedRSS(t *testing.T) {
	h, st := newFeedsOutTestHandler(t)
	_, groupID := seedFeedAndItems(t, st)
	r := h.SetupRouter()

	w := performRequest(r, http.MethodGet, "/groups/"+itoa(groupID)+"/rss.xml", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "First post") {
		t.Errorf("missing item in /groups/:id/rss.xml")
	}
}

func TestFeedRSS_InvalidID(t *testing.T) {
	h, _ := newFeedsOutTestHandler(t)
	r := h.SetupRouter()
	w := performRequest(r, http.MethodGet, "/feeds/abc/rss.xml", nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestFeedRSS_LimitParam(t *testing.T) {
	h, st := newFeedsOutTestHandler(t)
	feedID, _ := seedFeedAndItems(t, st)
	r := h.SetupRouter()

	w := performRequest(r, http.MethodGet, "/feeds/"+itoa(feedID)+"/rss.xml?limit=1", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	count := strings.Count(w.Body.String(), "<item>")
	if count != 1 {
		t.Errorf("expected 1 <item>, got %d\nbody=%s", count, w.Body.String())
	}
}

func TestPublicBaseURL(t *testing.T) {
	cases := []struct {
		name      string
		publicURL string
		headers   map[string]string
		host      string
		tls       bool
		want      string
	}{
		{
			name:      "configured",
			publicURL: "https://hub.example.com/",
			want:      "https://hub.example.com",
		},
		{
			name: "derived from request",
			host: "localhost:8080",
			want: "http://localhost:8080",
		},
		{
			name: "tls",
			host: "localhost:8080",
			tls:  true,
			want: "https://localhost:8080",
		},
		{
			name: "x-forwarded",
			host: "internal:80",
			headers: map[string]string{
				"X-Forwarded-Proto": "https",
				"X-Forwarded-Host":  "public.example.com",
			},
			want: "https://public.example.com",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := &Handler{config: &config.Config{PublicURL: tc.publicURL}}
			req := httptest.NewRequest("GET", "/", nil)
			req.Host = tc.host
			if tc.tls {
				req.TLS = fakeTLSConnState()
			}
			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = req
			got := h.PublicBaseURL(c)
			if got != tc.want {
				t.Errorf("PublicBaseURL = %q, want %q", got, tc.want)
			}
		})
	}
}

// itoa is a tiny helper to avoid pulling in strconv in this file.
func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

// fakeTLSConnState returns a non-nil *tls.ConnectionState so request.TLS != nil
// for the PublicBaseURL test that branches on TLS presence.
func fakeTLSConnState() *tlsConnectionState {
	s := tlsConnectionState{}
	return &s
}
