package handler

import (
	"context"
	"log/slog"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)



func (h *Handler) search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		badRequestError(c, "q parameter is required")
		return
	}

	mode := c.DefaultQuery("mode", "keyword") // keyword | semantic | hybrid
	limit := 10
	if l := c.Query("limit"); l != "" {
		parsed, err := strconv.Atoi(l)
		if err != nil || parsed < 1 {
			badRequestError(c, "invalid limit")
			return
		}
		if parsed > maxListLimit {
			parsed = maxListLimit
		}
		limit = parsed
	}

	feeds, err := h.store.SearchFeeds(q)
	if err != nil {
		internalError(c, err, "search feeds")
		return
	}

	var items any
	switch mode {
	case "semantic", "hybrid":
		items, err = h.searchSemantic(c.Request.Context(), q, mode, limit)
	default:
		items, err = h.store.SearchItems(q, limit)
	}
	if err != nil {
		internalError(c, err, "search items")
		return
	}

	dataResponse(c, gin.H{
		"feeds": feeds,
		"items": items,
		"mode":  mode,
	})
}

func (h *Handler) searchSemantic(ctx context.Context, query, mode string, limit int) (any, error) {
	if h.embedder == nil {
		// Fallback to keyword search if embedder is not configured.
		return h.store.SearchItems(query, limit)
	}

	vectors, err := h.embedder.Embed(ctx, []string{query})
	if err != nil {
		slog.Warn("semantic search embedding failed", "error", err)
		return h.store.SearchItems(query, limit)
	}
	if len(vectors) == 0 || len(vectors[0]) == 0 {
		return h.store.SearchItems(query, limit)
	}

	if mode == "hybrid" {
		return h.store.SearchItemsHybrid(query, vectors[0], limit)
	}
	return h.store.SearchItemsSemantic(vectors[0], limit)
}
