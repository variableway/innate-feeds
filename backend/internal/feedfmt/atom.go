package feedfmt

import (
	"encoding/xml"
	"fmt"
	"time"
)

type atomLink struct {
	XMLName xml.Name `xml:"link"`
	Href    string   `xml:"href,attr"`
	Rel     string   `xml:"rel,attr,omitempty"`
	Type    string   `xml:"type,attr,omitempty"`
	Title   string   `xml:"title,attr,omitempty"`
}

type atomAuthor struct {
	Name  string `xml:"name"`
	Email string `xml:"email,omitempty"`
	URI   string `xml:"uri,omitempty"`
}

type atomCategory struct {
	XMLName xml.Name `xml:"category"`
	Term    string   `xml:"term,attr"`
	Label   string   `xml:"label,attr,omitempty"`
}

type atomEntry struct {
	XMLName   xml.Name      `xml:"entry"`
	Title     string        `xml:"title"`
	ID        string        `xml:"id"`
	Updated   string        `xml:"updated"`
	Published string        `xml:"published,omitempty"`
	Links     []atomLink    `xml:"link"`
	Summary   *atomText     `xml:"summary,omitempty"`
	Content   *atomText     `xml:"content,omitempty"`
	Author    *atomAuthor   `xml:"author,omitempty"`
	Categories []atomCategory `xml:"category,omitempty"`
}

type atomText struct {
	Type string `xml:"type,attr,omitempty"`
	Body string `xml:",chardata"`
}

type atomFeed struct {
	XMLName xml.Name    `xml:"http://www.w3.org/2005/Atom feed"`
	ID      string      `xml:"id"`
	Title   string      `xml:"title"`
	Updated string      `xml:"updated"`
	Links   []atomLink  `xml:"link"`
	Author  *atomAuthor `xml:"author,omitempty"`
	Subtitle *atomText  `xml:"subtitle,omitempty"`
	Rights  *atomText   `xml:"rights,omitempty"`
	Generator *atomText `xml:"generator,omitempty"`
	Entries []atomEntry `xml:"entry"`
}

// RenderAtom renders entries as an Atom 1.0 document.
func RenderAtom(ch Channel, entries []Entry) ([]byte, error) {
	if ch.Updated.IsZero() {
		ch.Updated = time.Now()
	}
	if ch.Generator == "" {
		ch.Generator = "innate-hub"
	}
	if ch.ID == "" {
		ch.ID = ch.FeedLink
	}

	feed := atomFeed{
		ID:      ch.ID,
		Title:   ch.Title,
		Updated: ch.Updated.UTC().Format(time.RFC3339),
		Generator: &atomText{Type: "text", Body: ch.Generator},
	}
	if ch.Link != "" {
		feed.Links = append(feed.Links, atomLink{Href: ch.Link, Rel: "alternate", Type: "text/html"})
	}
	if ch.FeedLink != "" {
		feed.Links = append(feed.Links, atomLink{Href: ch.FeedLink, Rel: "self", Type: "application/atom+xml"})
	}
	if ch.Description != "" {
		feed.Subtitle = &atomText{Type: "text", Body: ch.Description}
	}
	if ch.Author != "" {
		feed.Author = &atomAuthor{Name: ch.Author}
	}

	for _, e := range entries {
		ent := atomEntry{
			Title:   e.Title,
			ID:      nonZero(e.ID, e.Link),
			Updated: pickTime(e.Updated, e.Published, ch.Updated).UTC().Format(time.RFC3339),
		}
		if !e.Published.IsZero() {
			ent.Published = e.Published.UTC().Format(time.RFC3339)
		}
		if e.Link != "" {
			ent.Links = append(ent.Links, atomLink{Href: e.Link, Rel: "alternate", Type: "text/html"})
		}
		if e.Description != "" {
			ent.Summary = &atomText{Type: "text", Body: e.Description}
		}
		if e.Content != "" {
			ent.Content = &atomText{Type: "html", Body: e.Content}
		}
		if e.Author != "" {
			ent.Author = &atomAuthor{Name: e.Author}
		}
		for _, c := range e.Categories {
			ent.Categories = append(ent.Categories, atomCategory{Term: c, Label: c})
		}
		feed.Entries = append(feed.Entries, ent)
	}

	body, err := xml.MarshalIndent(feed, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal atom: %w", err)
	}
	return append([]byte(xml.Header), body...), nil
}

func nonZero(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func pickTime(values ...time.Time) time.Time {
	for _, v := range values {
		if !v.IsZero() {
			return v
		}
	}
	return time.Now()
}
