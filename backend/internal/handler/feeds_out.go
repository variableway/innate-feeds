package handler

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/innate/hub/internal/feedfmt"
	"github.com/innate/hub/internal/model"
	"github.com/innate/hub/internal/store"
)

// feedOutputMaxLimit is the upper bound on ?limit to keep responses bounded.
const feedOutputMaxLimit = 500

// feedOutputDefaultLimit is used when ?limit is unset.
const feedOutputDefaultLimit = 50

// feedOutputCacheMaxAge is the Cache-Control we send for feed output.
const feedOutputCacheMaxAge = 60

// PublicBaseURL returns the absolute base URL the server should use when
// emitting feed links. It uses FUSION_PUBLIC_URL if set, otherwise derives
// from the request.
func (h *Handler) PublicBaseURL(c *gin.Context) string {
	if h.config != nil {
		if u := strings.TrimSpace(h.config.PublicURL); u != "" {
			return strings.TrimRight(u, "/")
		}
	}
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if v := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); v != "" {
		parts := strings.Split(v, ",")
		scheme = strings.TrimSpace(parts[0])
	}
	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}
	return scheme + "://" + host
}

// renderFeed writes the response for a (channel, entries) pair. It sets the
// correct Content-Type, Cache-Control, and ETag (when an ETag is supplied).
func renderFeed(c *gin.Context, format feedfmt.Format, ch feedfmt.Channel, entries []feedfmt.Entry, etag string) {
	body, err := feedRender(format, ch, entries)
	if err != nil {
		internalError(c, err, "render feed")
		return
	}
	fullETag := `"` + etag + `"`
	if match := c.GetHeader("If-None-Match"); match != "" && etag != "" {
		if etagMatches(match, fullETag) {
			c.Header("ETag", fullETag)
			c.Status(http.StatusNotModified)
			return
		}
	}
	c.Header("Content-Type", feedfmt.ContentType(format))
	c.Header("Cache-Control", fmt.Sprintf("public, max-age=%d", feedOutputCacheMaxAge))
	if etag != "" {
		c.Header("ETag", fullETag)
	}
	c.Status(http.StatusOK)
	_, _ = c.Writer.Write(body)
}

func feedRender(format feedfmt.Format, ch feedfmt.Channel, entries []feedfmt.Entry) ([]byte, error) {
	switch format {
	case feedfmt.RSS:
		return feedfmt.RenderRSS(ch, entries)
	case feedfmt.Atom:
		return feedfmt.RenderAtom(ch, entries)
	case feedfmt.JSONFeed:
		return feedfmt.RenderJSONFeed(ch, entries)
	}
	return nil, fmt.Errorf("unknown feed format: %d", format)
}

func etagMatches(headerValue, current string) bool {
	for _, part := range strings.Split(headerValue, ",") {
		part = strings.TrimSpace(part)
		if part == "*" || part == current {
			return true
		}
	}
	return false
}

// etagForEntries builds a stable ETag from the latest pubDate + count.
func etagForEntries(entries []feedfmt.Entry) string {
	if len(entries) == 0 {
		return "empty"
	}
	latest := int64(0)
	for _, e := range entries {
		ts := e.Published.Unix()
		if e.Updated.Unix() > ts {
			ts = e.Updated.Unix()
		}
		if ts > latest {
			latest = ts
		}
	}
	sum := sha1.Sum([]byte(fmt.Sprintf("%d-%d", latest, len(entries))))
	return hex.EncodeToString(sum[:])
}

func entriesToFeed(items []*model.Item, feedLookup map[int64]*model.Feed) []feedfmt.Entry {
	out := make([]feedfmt.Entry, 0, len(items))
	for _, it := range items {
		e := feedfmt.Entry{
			ID:          it.GUID,
			Title:       it.Title,
			Link:        it.Link,
			Description: "",
			Content:     it.Content,
			Published:   unixToTime(it.PubDate),
			Updated:     unixToTime(it.CreatedAt),
		}
		if e.ID == "" {
			e.ID = it.Link
		}
		if f, ok := feedLookup[it.FeedID]; ok && f != nil {
			e.Author = ""
			if c := strings.TrimSpace(f.Name); c != "" {
				e.Categories = []string{c}
			}
		}
		out = append(out, e)
	}
	return out
}

func unixToTime(sec int64) time.Time {
	if sec <= 0 {
		return time.Time{}
	}
	return time.Unix(sec, 0).UTC()
}

// parseListOutputParams reads ?unread, ?before, ?limit from the query string.
// Returns store.ListItemsParams with sensible defaults.
func parseListOutputParams(c *gin.Context) (store.ListItemsParams, error) {
	p := store.ListItemsParams{
		Limit:   feedOutputDefaultLimit,
		OrderBy: "pub_date",
	}
	if v := strings.TrimSpace(c.Query("unread")); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return p, fmt.Errorf("invalid unread: %w", err)
		}
		p.Unread = &b
	}
	if v := strings.TrimSpace(c.Query("before")); v != "" {
		ts, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return p, fmt.Errorf("invalid before: %w", err)
		}
		// Convert before=<unix> into a feed_id/pub_date boundary by re-using
		// Limit/Offset isn't enough; we approximate with a high offset.
		// A cleaner approach is to add a new ListItemsBefore query; until
		// that exists, we ignore the parameter and return the most recent.
		_ = ts
	}
	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return p, fmt.Errorf("invalid limit: %w", err)
		}
		if n <= 0 {
			return p, fmt.Errorf("invalid limit: must be > 0")
		}
		if n > feedOutputMaxLimit {
			n = feedOutputMaxLimit
		}
		p.Limit = n
	}
	return p, nil
}

func (h *Handler) feedForOutput(id int64) (*model.Feed, error) {
	feed, err := h.store.GetFeed(id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, err
		}
		return nil, err
	}
	return feed, nil
}

func (h *Handler) groupForOutput(id int64) (*model.Group, error) {
	g, err := h.store.GetGroup(id)
	if err != nil {
		return nil, err
	}
	return g, nil
}

// loadFeedLookup builds a small feed-id → *Feed map for entriesToFeed.
func (h *Handler) loadFeedLookup(ids []int64) (map[int64]*model.Feed, error) {
	out := make(map[int64]*model.Feed, len(ids))
	seen := make(map[int64]bool, len(ids))
	for _, id := range ids {
		if seen[id] {
			continue
		}
		seen[id] = true
		f, err := h.store.GetFeed(id)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				continue
			}
			return nil, err
		}
		out[id] = f
	}
	return out, nil
}

// channelForFeed builds the feedfmt.Channel for a single feed.
func (h *Handler) channelForFeed(c *gin.Context, f *model.Feed) feedfmt.Channel {
	base := h.PublicBaseURL(c)
	feedURL := fmt.Sprintf("%s/feeds/%d/%s", base, f.ID, feedfmt.FileExt(feedfmt.RSS))
	site := strings.TrimSpace(f.SiteURL)
	if site == "" {
		site = strings.TrimSpace(f.Link)
	}
	desc := fmt.Sprintf("Aggregated output for feed #%d (%s)", f.ID, f.Name)
	return feedfmt.Channel{
		Title:       f.Name,
		Link:        site,
		FeedLink:    feedURL,
		Description: desc,
		Generator:   "innate-hub",
		Updated:     time.Now(),
	}
}

// channelForGroup builds a channel for a group of feeds.
func (h *Handler) channelForGroup(c *gin.Context, g *model.Group) feedfmt.Channel {
	base := h.PublicBaseURL(c)
	feedURL := fmt.Sprintf("%s/groups/%d/%s", base, g.ID, feedfmt.FileExt(feedfmt.RSS))
	return feedfmt.Channel{
		Title:       g.Name,
		Link:        base,
		FeedLink:    feedURL,
		Description: fmt.Sprintf("All feeds in group #%d (%s)", g.ID, g.Name),
		Generator:   "innate-hub",
		Updated:     time.Now(),
	}
}

// channelForAll builds a channel for the global timeline.
func (h *Handler) channelForAll(c *gin.Context) feedfmt.Channel {
	base := h.PublicBaseURL(c)
	feedURL := fmt.Sprintf("%s/all/%s", base, feedfmt.FileExt(feedfmt.RSS))
	return feedfmt.Channel{
		Title:       "innate-hub — all items",
		Link:        base,
		FeedLink:    feedURL,
		Description: "All items across every feed in innate-hub",
		Generator:   "innate-hub",
		Updated:     time.Now(),
	}
}

// writeFeed is the common writer that builds entries, renders, and sends.
func (h *Handler) writeFeed(c *gin.Context, format feedfmt.Format, ch feedfmt.Channel, items []*model.Item) {
	feedIDs := make([]int64, 0, len(items))
	for _, it := range items {
		feedIDs = append(feedIDs, it.FeedID)
	}
	lookup, err := h.loadFeedLookup(feedIDs)
	if err != nil {
		internalError(c, err, "load feed lookup")
		return
	}
	entries := entriesToFeed(items, lookup)
	renderFeed(c, format, ch, entries, etagForEntries(entries))
}

// ----- per-route handlers -----

// feedRSS:    GET /feeds/:id/rss.xml
// feedAtom:   GET /feeds/:id/atom.xml
// feedJSON:   GET /feeds/:id/feed.json
func (h *Handler) feedRSS(c *gin.Context)    { h.renderFeedByID(c, feedfmt.RSS) }
func (h *Handler) feedAtom(c *gin.Context)   { h.renderFeedByID(c, feedfmt.Atom) }
func (h *Handler) feedJSON(c *gin.Context)   { h.renderFeedByID(c, feedfmt.JSONFeed) }

func (h *Handler) renderFeedByID(c *gin.Context, format feedfmt.Format) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequestError(c, "invalid id")
		return
	}
	feed, err := h.feedForOutput(id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFoundError(c, "feed")
			return
		}
		internalError(c, err, "get feed")
		return
	}
	params, err := parseListOutputParams(c)
	if err != nil {
		badRequestError(c, err.Error())
		return
	}
	fid := feed.ID
	params.FeedID = &fid

	items, err := h.store.ListItems(params)
	if err != nil {
		internalError(c, err, "list items")
		return
	}
	h.writeFeed(c, format, h.channelForFeed(c, feed), items)
}

func (h *Handler) groupRSS(c *gin.Context)  { h.renderFeedByGroup(c, feedfmt.RSS) }
func (h *Handler) groupAtom(c *gin.Context) { h.renderFeedByGroup(c, feedfmt.Atom) }
func (h *Handler) groupJSON(c *gin.Context) { h.renderFeedByGroup(c, feedfmt.JSONFeed) }

func (h *Handler) renderFeedByGroup(c *gin.Context, format feedfmt.Format) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequestError(c, "invalid id")
		return
	}
	g, err := h.groupForOutput(id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFoundError(c, "group")
			return
		}
		internalError(c, err, "get group")
		return
	}
	params, err := parseListOutputParams(c)
	if err != nil {
		badRequestError(c, err.Error())
		return
	}
	gid := g.ID
	params.GroupID = &gid

	items, err := h.store.ListItems(params)
	if err != nil {
		internalError(c, err, "list items")
		return
	}
	h.writeFeed(c, format, h.channelForGroup(c, g), items)
}

func (h *Handler) allRSS(c *gin.Context)  { h.renderAll(c, feedfmt.RSS) }
func (h *Handler) allAtom(c *gin.Context) { h.renderAll(c, feedfmt.Atom) }
func (h *Handler) allJSON(c *gin.Context) { h.renderAll(c, feedfmt.JSONFeed) }

func (h *Handler) renderAll(c *gin.Context, format feedfmt.Format) {
	params, err := parseListOutputParams(c)
	if err != nil {
		badRequestError(c, err.Error())
		return
	}
	items, err := h.store.ListItems(params)
	if err != nil {
		internalError(c, err, "list items")
		return
	}
	h.writeFeed(c, format, h.channelForAll(c), items)
}
