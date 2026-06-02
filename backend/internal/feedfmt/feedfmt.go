// Package feedfmt renders a slice of normalized feed entries as standard
// RSS 2.0, Atom 1.0, or JSON Feed 1.1.
//
// It is the "second half" of the adapter pipeline: adapters pull items
// from any source into the store, and this package re-emits them as feeds
// that any external reader can subscribe to.
package feedfmt

import "time"

// Format selects one of the three supported wire formats.
type Format int

const (
	RSS Format = iota
	Atom
	JSONFeed
)

// ContentType returns the HTTP Content-Type the renderer expects to be served as.
func ContentType(f Format) string {
	switch f {
	case RSS:
		return "application/rss+xml; charset=utf-8"
	case Atom:
		return "application/atom+xml; charset=utf-8"
	case JSONFeed:
		return "application/feed+json; charset=utf-8"
	}
	return "application/octet-stream"
}

// FileExt returns the conventional file extension for a format.
func FileExt(f Format) string {
	switch f {
	case RSS:
		return "rss.xml"
	case Atom:
		return "atom.xml"
	case JSONFeed:
		return "feed.json"
	}
	return "bin"
}

// Channel is the feed-level metadata shared by all three formats.
// FeedLink is the absolute URL the rendered feed is served from; Link is
// the canonical website URL the feed points at.
type Channel struct {
	Title       string
	Link        string
	FeedLink    string
	Description string
	Language    string
	Author      string
	Updated     time.Time
	Generator   string
	ID          string
}

// Enclosure describes a media attachment (audio, video, image).
type Enclosure struct {
	URL    string
	Length int64
	Type   string
}

// Entry is a single item, common to all three formats.
// Content holds the full HTML body; Description is a short summary.
type Entry struct {
	ID          string
	Title       string
	Link        string
	Description string
	Content     string
	Author      string
	Published   time.Time
	Updated     time.Time
	Categories  []string
	Enclosure   *Enclosure
}
