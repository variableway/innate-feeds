package feedfmt

import (
	"encoding/json"
	"encoding/xml"
	"strings"
	"testing"
	"time"
)

func sampleChannel() Channel {
	return Channel{
		Title:       "Innate Hub Test Feed",
		Link:        "https://example.com",
		FeedLink:    "https://hub.example.com/feeds/1/rss.xml",
		Description: "A test feed",
		Language:    "en-us",
		Author:      "Test Author",
		Updated:     time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC),
		Generator:   "innate-hub",
		ID:          "urn:uuid:12345",
	}
}

func sampleEntries() []Entry {
	return []Entry{
		{
			ID:          "https://example.com/post/1",
			Title:       "First post",
			Link:        "https://example.com/post/1",
			Description: "Short summary",
			Content:     "<p>Hello <b>world</b></p>",
			Author:      "Alice",
			Published:   time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC),
			Updated:     time.Date(2026, 6, 1, 11, 0, 0, 0, time.UTC),
			Categories:  []string{"news", "go"},
		},
		{
			ID:        "urn:uuid:second",
			Title:     "Second post",
			Link:      "https://example.com/post/2",
			Content:   "<p>Body only</p>",
			Published: time.Date(2026, 5, 30, 9, 0, 0, 0, time.UTC),
		},
	}
}

func TestRenderRSS_Basic(t *testing.T) {
	got, err := RenderRSS(sampleChannel(), sampleEntries())
	if err != nil {
		t.Fatalf("RenderRSS: %v", err)
	}
	body := string(got)

	if !strings.HasPrefix(body, "<?xml") {
		t.Errorf("missing XML header: %q", body[:min(40, len(body))])
	}
	if !strings.Contains(body, `<rss version="2.0"`) {
		t.Errorf("missing <rss version=2.0>")
	}
	if !strings.Contains(body, `<title>Innate Hub Test Feed</title>`) {
		t.Errorf("missing channel title")
	}
	// encoding/xml emits the atom and content modules as default-namespace
	// declarations on the inner element. Either form is valid XML and
	// readable by all common RSS readers.
	hasAtom := strings.Contains(body, `xmlns="http://www.w3.org/2005/Atom"`) ||
		strings.Contains(body, `xmlns:atom="http://www.w3.org/2005/Atom"`)
	if !hasAtom {
		t.Errorf("missing atom namespace declaration in body:\n%s", body)
	}
	hasContent := strings.Contains(body, `xmlns="http://purl.org/rss/1.0/modules/content/"`) ||
		strings.Contains(body, `xmlns:content="http://purl.org/rss/1.0/modules/content/"`)
	if !hasContent {
		t.Errorf("missing content namespace declaration in body:\n%s", body)
	}
	if !strings.Contains(body, `href="https://hub.example.com/feeds/1/rss.xml"`) {
		t.Errorf("missing feed self link in body:\n%s", body)
	}
	if !strings.Contains(body, `<encoded`) ||
		!strings.Contains(body, `&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;`) {
		t.Errorf("content:encoded missing or wrong in body:\n%s", body)
	}
	if !strings.Contains(body, `<guid isPermaLink="false">https://example.com/post/1</guid>`) {
		t.Errorf("absolute URL guid should have isPermaLink=false")
	}
	if !strings.Contains(body, `<guid>urn:uuid:second</guid>`) {
		t.Errorf("URN guid missing isPermaLink")
	}
	if !strings.Contains(body, `<pubDate>Mon, 01 Jun 2026 10:00:00 +0000</pubDate>`) {
		t.Errorf("pubDate format wrong")
	}

	// Round-trip: parse it back to confirm well-formed.
	var parsed rssRoot
	if err := xml.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("re-parse failed: %v\n%s", err, body)
	}
	if parsed.Channel.Title != "Innate Hub Test Feed" {
		t.Errorf("parsed title = %q", parsed.Channel.Title)
	}
	if len(parsed.Channel.Items) != 2 {
		t.Errorf("expected 2 items, got %d", len(parsed.Channel.Items))
	}
}

func TestRenderAtom_Basic(t *testing.T) {
	got, err := RenderAtom(sampleChannel(), sampleEntries())
	if err != nil {
		t.Fatalf("RenderAtom: %v", err)
	}
	body := string(got)

	if !strings.Contains(body, `<feed xmlns="http://www.w3.org/2005/Atom">`) {
		t.Errorf("missing atom feed root")
	}
	// encoding/xml renders self-closing tags with separate close tags, so
	// accept both forms.
	hasAlt := strings.Contains(body, `<link href="https://example.com" rel="alternate" type="text/html"/>`) ||
		strings.Contains(body, `<link href="https://example.com" rel="alternate" type="text/html"></link>`)
	if !hasAlt {
		t.Errorf("missing alternate link")
	}
	if !strings.Contains(body, `<link href="https://hub.example.com/feeds/1/rss.xml" rel="self"`) {
		t.Errorf("missing self link")
	}
	if !strings.Contains(body, `<id>urn:uuid:12345</id>`) {
		t.Errorf("missing feed id")
	}
	if !strings.Contains(body, `<entry>`) {
		t.Errorf("missing entry")
	}
	if !strings.Contains(body, `<content type="html">&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</content>`) {
		t.Errorf("atom content not html-escaped: %s", body)
	}

	var parsed atomFeed
	if err := xml.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("re-parse failed: %v\n%s", err, body)
	}
	if len(parsed.Entries) != 2 {
		t.Errorf("expected 2 entries, got %d", len(parsed.Entries))
	}
	if parsed.Entries[0].ID != "https://example.com/post/1" {
		t.Errorf("entry id = %q", parsed.Entries[0].ID)
	}
	if parsed.Entries[0].Published == "" {
		t.Errorf("entry published missing")
	}
}

func TestRenderJSONFeed_Basic(t *testing.T) {
	got, err := RenderJSONFeed(sampleChannel(), sampleEntries())
	if err != nil {
		t.Fatalf("RenderJSONFeed: %v", err)
	}
	var parsed jsonFeed
	if err := json.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("json re-parse failed: %v\n%s", err, string(got))
	}
	if parsed.Version != "https://www.jsonfeed.org/version/1.1" {
		t.Errorf("version = %q", parsed.Version)
	}
	if parsed.Title != "Innate Hub Test Feed" {
		t.Errorf("title = %q", parsed.Title)
	}
	if parsed.HomePageURL != "https://example.com" {
		t.Errorf("home_page_url = %q", parsed.HomePageURL)
	}
	if len(parsed.Items) != 2 {
		t.Errorf("expected 2 items, got %d", len(parsed.Items))
	}
	if parsed.Items[0].ContentHTML != "<p>Hello <b>world</b></p>" {
		t.Errorf("item 0 content_html = %q", parsed.Items[0].ContentHTML)
	}
	if parsed.Items[0].DatePublished == "" {
		t.Errorf("item 0 date_published empty")
	}
	if len(parsed.Items[0].Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(parsed.Items[0].Tags))
	}
}

func TestRender_EmptyEntries(t *testing.T) {
	rss, err := RenderRSS(sampleChannel(), nil)
	if err != nil {
		t.Fatalf("rss: %v", err)
	}
	if !strings.Contains(string(rss), "<channel>") {
		t.Errorf("empty RSS missing channel")
	}

	atom, err := RenderAtom(sampleChannel(), nil)
	if err != nil {
		t.Fatalf("atom: %v", err)
	}
	if strings.Contains(string(atom), "<entry>") {
		t.Errorf("empty Atom should not have entries")
	}

	jf, err := RenderJSONFeed(sampleChannel(), nil)
	if err != nil {
		t.Fatalf("jsonfeed: %v", err)
	}
	if !strings.Contains(string(jf), `"items": []`) {
		t.Errorf("empty JSON Feed should have empty items array, got:\n%s", string(jf))
	}
}

func TestContentType(t *testing.T) {
	if ContentType(RSS) != "application/rss+xml; charset=utf-8" {
		t.Errorf("RSS ContentType wrong")
	}
	if ContentType(Atom) != "application/atom+xml; charset=utf-8" {
		t.Errorf("Atom ContentType wrong")
	}
	if ContentType(JSONFeed) != "application/feed+json; charset=utf-8" {
		t.Errorf("JSONFeed ContentType wrong")
	}
}

func TestRenderRSS_XMLEscape(t *testing.T) {
	ch := sampleChannel()
	entries := []Entry{{
		ID:    "x",
		Title: "Title with <tag> & ampersand",
		Link:  "https://example.com/x",
	}}
	got, err := RenderRSS(ch, entries)
	if err != nil {
		t.Fatalf("RenderRSS: %v", err)
	}
	body := string(got)
	if !strings.Contains(body, `&lt;tag&gt; &amp; ampersand`) {
		t.Errorf("title not properly escaped:\n%s", body)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
