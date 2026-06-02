package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"

	"github.com/innate/hub/internal/auth"
	"github.com/gin-gonic/gin"
)

type createAPIKeyRequest struct {
	Name string `json:"name"`
}

type createAPIKeyResponse struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	APIKey  string `json:"api_key"` // plaintext, shown only once
	Created int64  `json:"created_at"`
}

// generateRandomKey creates a secure random API key with prefix.
func generateRandomKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "ih_" + hex.EncodeToString(b), nil
}

func (h *Handler) createAPIKey(c *gin.Context) {
	var req createAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequestError(c, "invalid request")
		return
	}

	plaintext, err := generateRandomKey()
	if err != nil {
		internalError(c, err, "generate api key")
		return
	}

	hash, err := auth.HashPassword(plaintext)
	if err != nil {
		internalError(c, err, "hash api key")
		return
	}

	id, err := h.store.CreateAPIKey(req.Name, hash)
	if err != nil {
		internalError(c, err, "create api key")
		return
	}

	dataResponse(c, createAPIKeyResponse{
		ID:      id,
		Name:    req.Name,
		APIKey:  plaintext,
		Created: 0, // store will fill this on read
	})
}

func (h *Handler) listAPIKeys(c *gin.Context) {
	keys, err := h.store.ListAPIKeys()
	if err != nil {
		internalError(c, err, "list api keys")
		return
	}
	// Don't expose key_hash in the response
	type keyView struct {
		ID         int64  `json:"id"`
		Name       string `json:"name"`
		CreatedAt  int64  `json:"created_at"`
		LastUsedAt int64  `json:"last_used_at"`
	}
	var views []keyView
	for _, k := range keys {
		views = append(views, keyView{
			ID:         k.ID,
			Name:       k.Name,
			CreatedAt:  k.CreatedAt,
			LastUsedAt: k.LastUsedAt,
		})
	}
	dataResponse(c, views)
}

func (h *Handler) deleteAPIKey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		badRequestError(c, "invalid id")
		return
	}

	if err := h.store.DeleteAPIKey(id); err != nil {
		internalError(c, err, "delete api key")
		return
	}

	c.Status(http.StatusNoContent)
}
