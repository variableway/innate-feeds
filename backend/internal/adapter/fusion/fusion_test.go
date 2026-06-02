package fusion

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/innate/hub/internal/model"
)

func newFeverServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return srv
}

func fakeFeverResponse(auth int, items []feverItem, feeds []feverFeed) feverResponse {
	return feverResponse{
		Auth:          auth,
		LastRefreshed: time.Now().Unix(),
		Feeds:         feeds,
		Items:         items,
		TotalItems:    len(items),
	}
}

func expectedKey(u, p string) string {
	sum := md5.Sum([]byte(u + ":" + p))
	return hex.EncodeToString(sum[:])
}

// pullItems is a tiny helper: call Pull and return the items slice.
func pullItems(t *testing.T, a *Adapter, feed *model.Feed) []model.Item {
	t.Helper()
	result, err := a.Pull(context.Background(), feed, 5*time.Second)
	if err != nil {
		t.Fatalf("Pull: %v", err)
	}
	return result.Items
}

func TestPull_HappyPath(t *testing.T) {
	username, password := "alice", "secret"
	key := expectedKey(username, password)

	var lastPath string
	var lastForm url.Values
	srv := newFeverServer(t, func(w http.ResponseWriter, r *http.Request) {
		lastPath = r.URL.Path
		_ = r.ParseForm()
		lastForm = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(fakeFeverResponse(1,
			[]feverItem{
				{ID: 100, FeedID: 1, Title: "Hello", HTML: "<p>body</p>", URL: "https://example.com/hello", CreatedOnTime: 1717228800},
				{ID: 101, FeedID: 1, Title: "World", HTML: "<p>world</p>", URL: "https://example.com/world", CreatedOnTime: 1717315200},
				{ID: 102, FeedID: 2, Title: "Other feed", HTML: "<p>other</p>", URL: "https://example.com/other", CreatedOnTime: 1717401600},
			},
			[]feverFeed{
				{ID: 1, Title: "Example Feed", SiteURL: "https://example.com"},
				{ID: 2, Title: "Other", SiteURL: "https://other.example.com"},
			},
		))
	})

	a := New(srv.URL, username, password)
	items := pullItems(t, a, &model.Feed{Link: srv.URL})

	if lastPath != "/" {
		t.Errorf("path = %q, want /", lastPath)
	}
	if lastForm.Get("api_key") != key {
		t.Errorf("api_key mismatch: got %q, want %q", lastForm.Get("api_key"), key)
	}
	if lastForm.Get("api") != "1" {
		t.Errorf("api=1 missing")
	}
	if len(items) != 3 {
		t.Fatalf("items = %d, want 3", len(items))
	}
	if items[0].Title != "Hello" {
		t.Errorf("first title = %q", items[0].Title)
	}
	if items[0].Link != "https://example.com/hello" {
		t.Errorf("first link = %q", items[0].Link)
	}
	if items[0].PubDate != 1717228800 {
		t.Errorf("first pubDate = %d", items[0].PubDate)
	}
	if items[0].GUID != "fusion:1:100" {
		t.Errorf("first guid = %q", items[0].GUID)
	}
}

func TestPull_FilterByFeedID(t *testing.T) {
	srv := newFeverServer(t, func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(fakeFeverResponse(1,
			[]feverItem{
				{ID: 1, FeedID: 1, Title: "A", URL: "https://e/a", CreatedOnTime: 1},
				{ID: 2, FeedID: 2, Title: "B", URL: "https://e/b", CreatedOnTime: 2},
				{ID: 3, FeedID: 1, Title: "C", URL: "https://e/c", CreatedOnTime: 3},
			},
			nil,
		))
	})

	a := New(srv.URL, "u", "p")
	items := pullItems(t, a, &model.Feed{Link: srv.URL + "?feed=2"})
	if len(items) != 1 {
		t.Fatalf("items = %d, want 1", len(items))
	}
	if items[0].Title != "B" {
		t.Errorf("title = %q, want B", items[0].Title)
	}
}

func TestPull_AuthFailure(t *testing.T) {
	srv := newFeverServer(t, func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(fakeFeverResponse(0, nil, nil))
	})
	a := New(srv.URL, "u", "p")
	_, err := a.Pull(context.Background(), &model.Feed{Link: srv.URL}, 5*time.Second)
	if err == nil || !strings.Contains(err.Error(), "auth=0") {
		t.Errorf("expected auth=0 error, got %v", err)
	}
}

func TestPull_HTTPError(t *testing.T) {
	srv := newFeverServer(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	a := New(srv.URL, "u", "p")
	_, err := a.Pull(context.Background(), &model.Feed{Link: srv.URL}, 5*time.Second)
	if err == nil || !strings.Contains(err.Error(), "HTTP 500") {
		t.Errorf("expected HTTP 500, got %v", err)
	}
}

func TestPull_FallbackLinkToSiteURL(t *testing.T) {
	srv := newFeverServer(t, func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(fakeFeverResponse(1,
			[]feverItem{
				{ID: 1, FeedID: 7, Title: "no url", URL: "", CreatedOnTime: 1},
			},
			[]feverFeed{
				{ID: 7, Title: "X", SiteURL: "https://x.example.com/"},
			},
		))
	})
	a := New(srv.URL, "u", "p")
	items := pullItems(t, a, &model.Feed{Link: srv.URL})
	if items[0].Link != "https://x.example.com/" {
		t.Errorf("link fallback failed: %q", items[0].Link)
	}
}

func TestPull_StableGUID(t *testing.T) {
	srv := newFeverServer(t, func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(fakeFeverResponse(1,
			[]feverItem{{ID: 1, FeedID: 1, Title: "x", URL: "u", CreatedOnTime: 1}},
			nil,
		))
	})
	a := New(srv.URL, "u", "p")
	first := pullItems(t, a, &model.Feed{Link: srv.URL})
	second := pullItems(t, a, &model.Feed{Link: srv.URL})
	if first[0].GUID != second[0].GUID {
		t.Errorf("GUID not stable: %q vs %q", first[0].GUID, second[0].GUID)
	}
}

func TestPull_EmptyResponse(t *testing.T) {
	srv := newFeverServer(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"auth":1,"items":[],"feeds":[]}`))
	})
	a := New(srv.URL, "u", "p")
	items := pullItems(t, a, &model.Feed{Link: srv.URL})
	if len(items) != 0 {
		t.Errorf("items = %d, want 0", len(items))
	}
}

func TestParseFeedIDFromLink(t *testing.T) {
	cases := []struct {
		in   string
		want int64
	}{
		{"https://example.com/fever?feed=12", 12},
		{"https://example.com/fever?feed_id=42", 0}, // we only match "feed="
		{"https://example.com/feeds/7", 7},
		{"https://example.com/feeds/7/items", 0},
		{"", 0},
		{"https://example.com/abc", 0},
		{"feed=9", 9},
		{"feed=123abc", 123},
	}
	for _, c := range cases {
		if got := parseFeedIDFromLink(c.in); got != c.want {
			t.Errorf("parseFeedIDFromLink(%q) = %d, want %d", c.in, got, c.want)
		}
	}
}

func TestDeriveFeverAPIKey(t *testing.T) {
	got := deriveFeverAPIKey("alice", "secret")
	want := expectedKey("alice", "secret")
	if got != want {
		t.Errorf("deriveFeverAPIKey = %q, want %q", got, want)
	}
}
