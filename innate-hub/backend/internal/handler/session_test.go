package handler

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/innate/hub/internal/auth"
	"github.com/innate/hub/internal/config"
	"github.com/innate/hub/internal/store"
	"github.com/gin-gonic/gin"
)

func newTestSessionHandler(t *testing.T, password string) (*Handler, *store.Store) {
	t.Helper()

	st, err := store.New(":memory:")
	if err != nil {
		t.Fatalf("new store: %v", err)
	}

	cfg := &config.Config{
		Password:       password,
		FeverUsername:  "test",
		LoginRateLimit: 10,
		LoginWindow:    60,
		LoginBlock:     300,
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		_ = st.Close()
		t.Fatalf("hash password: %v", err)
	}

	h := &Handler{
		store:        st,
		config:       cfg,
		passwordHash: hash,
		feverAPIKey:  deriveFeverAPIKey(cfg.FeverUsername, password),
		allowAnonAPI: password == "",
		limiter:      newLoginLimiter(10, 60, 300),
	}

	t.Cleanup(func() {
		_ = st.Close()
	})

	return h, st
}

func TestLogin(t *testing.T) {
	tests := []struct {
		name           string
		passwordHashOf string
		body           string
		wantStatus     int
		wantCookie     bool
	}{
		{
			name:           "rejects missing password field",
			passwordHashOf: "secret",
			body:           `{}`,
			wantStatus:     http.StatusBadRequest,
		},
		{
			name:           "accepts empty password when configured",
			passwordHashOf: "",
			body:           `{"password":""}`,
			wantStatus:     http.StatusOK,
			wantCookie:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h, _ := newTestSessionHandler(t, tt.passwordHashOf)

			r := newTestRouter()
			r.POST("/api/sessions", h.login)
			w := performRequest(
				r,
				http.MethodPost,
				"/api/sessions",
				strings.NewReader(tt.body),
				map[string]string{"Content-Type": "application/json"},
			)

			if w.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d", tt.wantStatus, w.Code)
			}
			if !tt.wantCookie {
				return
			}
			if cookie := w.Header().Get("Set-Cookie"); !strings.Contains(cookie, "session=") {
				t.Fatalf("expected session cookie to be set, got %q", cookie)
			}
		})
	}
}

func TestAuthMiddleware(t *testing.T) {
	tests := []struct {
		name          string
		token         string
		expiresAt     int64
		wantStatus    int
		wantStillLive bool
		allowAnonAPI  bool
	}{
		{
			name:          "rejects expired session",
			token:         "expired",
			expiresAt:     time.Now().Add(-time.Minute).Unix(),
			wantStatus:    http.StatusUnauthorized,
			wantStillLive: false,
		},
		{
			name:          "allows valid session",
			token:         "valid",
			expiresAt:     time.Now().Add(time.Minute).Unix(),
			wantStatus:    http.StatusOK,
			wantStillLive: true,
		},
		{
			name:          "allows requests when auth is disabled",
			wantStatus:    http.StatusOK,
			wantStillLive: false,
			allowAnonAPI:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h, st := newTestSessionHandler(t, "secret")
			h.allowAnonAPI = tt.allowAnonAPI
			if tt.token != "" {
				expires := time.Unix(tt.expiresAt, 0)
				_ = st.CreateSession(tt.token, expires)
			}

			r := newTestRouter()
			r.Use(h.authMiddleware())
			r.GET("/api/protected", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})
			w := performRequest(
				r,
				http.MethodGet,
				"/api/protected",
				nil,
				nil,
				&http.Cookie{Name: "session", Value: tt.token},
			)

			if w.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d", tt.wantStatus, w.Code)
			}

			// Check if session still exists in store
			exists, _ := st.GetSession(tt.token)
			if exists != tt.wantStillLive {
				t.Fatalf("session exists = %v, want %v", exists, tt.wantStillLive)
			}
		})
	}
}
