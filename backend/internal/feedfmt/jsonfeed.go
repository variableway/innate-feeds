package feedfmt

import (
	"encoding/json"
	"fmt"
	"time"
)

// JSON Feed 1.1 — https://www.jsonfeed.org/version/1.1/

type jsonFeedAuthor struct {
	Name string `json:"name,omitempty"`
	URL  string `json:"url,omitempty"`
}

type jsonFeedAttachment struct {
	URL      string `json:"url"`
	MIMEType string `json:"mime_type,omitempty"`
	Size     int64  `json:"size_in_bytes,omitempty"`
}

type jsonFeedItem struct {
	ID            string              `json:"id"`
	URL           string              `json:"url,omitempty"`
	ExternalURL   string              `json:"external_url,omitempty"`
	Title         string              `json:"title,omitempty"`
	ContentHTML   string              `json:"content_html,omitempty"`
	ContentText   string              `json:"content_text,omitempty"`
	Summary       string              `json:"summary,omitempty"`
	DatePublished string              `json:"date_published,omitempty"`
	DateModified  string              `json:"date_modified,omitempty"`
	Tags          []string            `json:"tags,omitempty"`
	Authors       []jsonFeedAuthor    `json:"authors,omitempty"`
	Attachments   []jsonFeedAttachment `json:"attachments,omitempty"`
}

type jsonFeed struct {
	Version     string          `json:"version"`
	Title       string          `json:"title"`
	HomePageURL string          `json:"home_page_url,omitempty"`
	FeedURL     string          `json:"feed_url,omitempty"`
	Description string          `json:"description,omitempty"`
	UserComment string          `json:"user_comment,omitempty"`
	Language    string          `json:"language,omitempty"`
	Authors     []jsonFeedAuthor `json:"authors,omitempty"`
	Generator   string          `json:"generator,omitempty"`
	Items       []jsonFeedItem  `json:"items"`
}

// RenderJSONFeed renders entries as a JSON Feed 1.1 document.
func RenderJSONFeed(ch Channel, entries []Entry) ([]byte, error) {
	if ch.Generator == "" {
		ch.Generator = "innate-hub"
	}
	out := jsonFeed{
		Version:     "https://www.jsonfeed.org/version/1.1",
		Title:       ch.Title,
		HomePageURL: ch.Link,
		FeedURL:     ch.FeedLink,
		Description: ch.Description,
		Language:    ch.Language,
		Generator:   ch.Generator,
		UserComment: "This feed allows you to read the posts from this site in any feed reader.",
	}
	if ch.Author != "" {
		out.Authors = []jsonFeedAuthor{{Name: ch.Author}}
	}
	// Always render items as an array, even when empty — the JSON Feed spec
	// requires this and readers that check the field type otherwise break.
	out.Items = []jsonFeedItem{}

	for _, e := range entries {
		item := jsonFeedItem{
			ID:      nonZero(e.ID, e.Link),
			URL:     e.Link,
			Title:   e.Title,
			Summary: e.Description,
		}
		if e.Content != "" {
			item.ContentHTML = e.Content
		}
		if !e.Published.IsZero() {
			item.DatePublished = e.Published.UTC().Format(time.RFC3339)
		}
		if !e.Updated.IsZero() {
			item.DateModified = e.Updated.UTC().Format(time.RFC3339)
		}
		if e.Author != "" {
			item.Authors = []jsonFeedAuthor{{Name: e.Author}}
		}
		if len(e.Categories) > 0 {
			item.Tags = e.Categories
		}
		if e.Enclosure != nil {
			item.Attachments = []jsonFeedAttachment{{
				URL:      e.Enclosure.URL,
				MIMEType: e.Enclosure.Type,
				Size:     e.Enclosure.Length,
			}}
		}
		out.Items = append(out.Items, item)
	}

	body, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal jsonfeed: %w", err)
	}
	return body, nil
}
