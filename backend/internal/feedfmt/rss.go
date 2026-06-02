package feedfmt

import (
	"encoding/xml"
	"fmt"
	"time"
)

// rssNamespace declarations. Putting them on the root <rss> element with
// conventional prefixes matches the way most aggregators and validators
// expect to see the atom self-link and the content:encoded module.
const (
	rssAtomNS    = "http://www.w3.org/2005/Atom"
	rssContentNS = "http://purl.org/rss/1.0/modules/content/"
)

type rssChannelXML struct {
	Title         string       `xml:"title"`
	Link          string       `xml:"link"`
	Description   string       `xml:"description"`
	Language      string       `xml:"language,omitempty"`
	LastBuildDate string       `xml:"lastBuildDate,omitempty"`
	Generator     string       `xml:"generator,omitempty"`
	AtomSelfLink  *rssAtomLink `xml:"http://www.w3.org/2005/Atom link"`
	Items         []rssItemXML `xml:"item"`
}

type rssAtomLink struct {
	XMLName xml.Name `xml:"http://www.w3.org/2005/Atom link"`
	Href    string   `xml:"href,attr"`
	Rel     string   `xml:"rel,attr"`
	Type    string   `xml:"type,attr"`
}

type rssItemXML struct {
	Title       string         `xml:"title"`
	Link        string         `xml:"link"`
	Description string         `xml:"description"`
	Content     *rssContentXML `xml:"http://purl.org/rss/1.0/modules/content/ encoded"`
	GUID        *rssGUIDXML    `xml:"guid"`
	PubDate     string         `xml:"pubDate"`
	Author      string         `xml:"author,omitempty"`
	Categories  []string       `xml:"category,omitempty"`
	Enclosure   *rssEncXML     `xml:"enclosure"`
}

type rssContentXML struct {
	XMLName xml.Name `xml:"http://purl.org/rss/1.0/modules/content/ encoded"`
	Type    string   `xml:"type,attr"`
	Inner   string   `xml:",chardata"`
}

type rssGUIDXML struct {
	IsPermaLink string `xml:"isPermaLink,attr,omitempty"`
	Value       string `xml:",chardata"`
}

type rssEncXML struct {
	URL    string `xml:"url,attr"`
	Length int64  `xml:"length,attr"`
	Type   string `xml:"type,attr"`
}

type rssRoot struct {
	XMLName     xml.Name `xml:"rss"`
	Version     string   `xml:"version,attr"`
	AtomNS      string   `xml:"xmlns:atom,attr"`
	ContentNS   string   `xml:"xmlns:content,attr"`
	Channel     rssChannelXML `xml:"channel"`
}

// RenderRSS renders entries as an RSS 2.0 document with content:encoded.
func RenderRSS(ch Channel, entries []Entry) ([]byte, error) {
	if ch.Updated.IsZero() {
		ch.Updated = time.Now()
	}
	if ch.Generator == "" {
		ch.Generator = "innate-hub"
	}

	root := rssRoot{
		Version:   "2.0",
		AtomNS:    rssAtomNS,
		ContentNS: rssContentNS,
		Channel: rssChannelXML{
			Title:         ch.Title,
			Link:          ch.Link,
			Description:   ch.Description,
			Language:      ch.Language,
			LastBuildDate: ch.Updated.UTC().Format(time.RFC1123Z),
			Generator:     ch.Generator,
		},
	}
	if ch.FeedLink != "" {
		root.Channel.AtomSelfLink = &rssAtomLink{
			Href: ch.FeedLink,
			Rel:  "self",
			Type: "application/rss+xml",
		}
	}

	for _, e := range entries {
		item := rssItemXML{
			Title:       e.Title,
			Link:        e.Link,
			Description: e.Description,
		}
		if e.Content != "" {
			item.Content = &rssContentXML{Type: "text/html", Inner: e.Content}
		}
		if e.ID != "" {
			item.GUID = &rssGUIDXML{Value: e.ID}
			if isAbsURL(e.ID) {
				item.GUID.IsPermaLink = "false"
			}
		}
		if !e.Published.IsZero() {
			item.PubDate = e.Published.UTC().Format(time.RFC1123Z)
		}
		if e.Author != "" {
			item.Author = e.Author
		}
		if len(e.Categories) > 0 {
			item.Categories = e.Categories
		}
		if e.Enclosure != nil {
			item.Enclosure = &rssEncXML{
				URL:    e.Enclosure.URL,
				Length: e.Enclosure.Length,
				Type:   e.Enclosure.Type,
			}
		}
		root.Channel.Items = append(root.Channel.Items, item)
	}

	body, err := xml.MarshalIndent(root, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal rss: %w", err)
	}
	return append([]byte(xml.Header), body...), nil
}

func isAbsURL(s string) bool {
	if len(s) < 8 {
		return false
	}
	prefix := s[:8]
	return prefix == "https://" || prefix == "http://" ||
		(len(s) >= 7 && s[:7] == "feed://") ||
		(len(s) >= 6 && s[:6] == "ftp://")
}
