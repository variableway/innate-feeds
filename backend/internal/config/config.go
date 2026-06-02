package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DBPath        string
	Password      string // Plaintext password from env
	Port          int
	FeverUsername string // Username used to derive Fever API key.

	CORSAllowedOrigins []string // Allowed Origins for CORS. Empty means allow all.
	TrustedProxies     []string // Trusted reverse proxies for client IP resolution. Empty disables proxy trust.
	AllowPrivateFeeds  bool     // Allow pulling private/localhost feed URLs.

	PullInterval    int // Pull interval in seconds (default: 1800 = 30 min)
	PullTimeout     int // Request timeout in seconds (default: 30)
	PullConcurrency int // Max concurrent pulls (default: 10)
	PullMaxBackoff  int // Global max scheduling delay in seconds (default: 172800 = 48 hours)

	LoginRateLimit int // Max failed login attempts per window (default: 10)
	LoginWindow    int // Login rate limit window in seconds (default: 60)
	LoginBlock     int // Login block duration in seconds (default: 300)

	LogLevel  string // Log level: DEBUG, INFO, WARN, ERROR (default: INFO)
	LogFormat string // Log format: text, json, auto (default: auto)

	// OIDC Configuration (optional, enabled when OIDCIssuer is set)
	OIDCIssuer       string // OIDC provider URL
	OIDCClientID     string // OAuth2 client ID
	OIDCClientSecret string // OAuth2 client secret
	OIDCRedirectURI  string // Callback URL (required when OIDC is enabled)
	OIDCAllowedUser  string // Optional: restrict to specific user identity (email or sub)

	// Semantic Search (optional, disabled if EmbedderProvider is empty)
	EmbedderProvider   string // "openai", "ollama", or "" (disabled)
	EmbedderModel      string // Model name, provider-specific
	EmbedderBaseURL    string // API base URL
	EmbedderAPIKey     string // API key (required for OpenAI)
	EmbedderDimensions int    // Vector size for the items.embedding_vec column. 0 = auto-detect from model.

	// Trending sources (optional)
	GitHubToken       string // GitHub PAT for higher API rate limits
	GitHubAPIURL      string // GitHub API base URL (default: https://api.github.com)
	ProductHuntToken  string // Product Hunt API developer token
	ProductHuntAPIURL string // Product Hunt API URL (default: https://api.producthunt.com/v2/api/graphql)

	// PublicURL is the absolute base URL the server should use when emitting
	// feed links in RSS/Atom/JSON-Feed output. When empty, the handler
	// derives it from the request (X-Forwarded-Proto/Host or Host header).
	PublicURL string

	// FusionSourcesJSON configures one or more remote Fusion instances to
	// pull from as if they were local feeds. Format: a JSON array of
	// {"name": "...", "base_url": "...", "username": "...", "password": "..."}.
	// Empty means no remote sources.
	FusionSourcesJSON string
}

func Load() (*Config, error) {
	// Env var lookup order, newest first:
	//   FUSION_DB_PATH   > HUB_DB_PATH   > DB       > "fusion.db"
	//   FUSION_PASSWORD  > HUB_PASSWORD  > PASSWORD > ""
	//   FUSION_PORT      > HUB_PORT      > PORT     > "8080"
	// The HUB_* aliases exist so existing scripts and muscle memory keep
	// working; FUSION_* is the canonical name.
	dbPath := firstNonEmpty(os.Getenv("FUSION_DB_PATH"), os.Getenv("HUB_DB_PATH"), os.Getenv("DB"), "fusion.db")

	password := firstNonEmpty(os.Getenv("FUSION_PASSWORD"), os.Getenv("HUB_PASSWORD"), os.Getenv("PASSWORD"), "")

	allowEmptyPassword, err := getEnvBool("FUSION_ALLOW_EMPTY_PASSWORD", false)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(password) == "" && !allowEmptyPassword {
		return nil, fmt.Errorf("FUSION_PASSWORD is required (or set FUSION_ALLOW_EMPTY_PASSWORD=true)")
	}

	port := firstNonEmpty(os.Getenv("FUSION_PORT"), os.Getenv("HUB_PORT"), os.Getenv("PORT"), "8080")
	parsedPort, err := parsePort(port)
	if err != nil {
		return nil, fmt.Errorf("invalid FUSION_PORT: %w", err)
	}
	if parsedPort <= 0 || parsedPort > 65535 {
		return nil, fmt.Errorf("invalid FUSION_PORT: must be in range 1-65535")
	}

	pullInterval, err := getEnvInt("FUSION_PULL_INTERVAL", 1800, 1)
	if err != nil {
		return nil, err
	}
	pullTimeout, err := getEnvInt("FUSION_PULL_TIMEOUT", 30, 1)
	if err != nil {
		return nil, err
	}
	pullConcurrency, err := getEnvInt("FUSION_PULL_CONCURRENCY", 10, 1)
	if err != nil {
		return nil, err
	}
	pullMaxBackoff, err := getEnvInt("FUSION_PULL_MAX_BACKOFF", 172800, 1)
	if err != nil {
		return nil, err
	}

	loginRateLimit, err := getEnvInt("FUSION_LOGIN_RATE_LIMIT", 10, 1)
	if err != nil {
		return nil, err
	}
	loginWindow, err := getEnvInt("FUSION_LOGIN_WINDOW", 60, 1)
	if err != nil {
		return nil, err
	}
	loginBlock, err := getEnvInt("FUSION_LOGIN_BLOCK", 300, 1)
	if err != nil {
		return nil, err
	}

	corsAllowedOrigins := parseCSVEnv(os.Getenv("FUSION_CORS_ALLOWED_ORIGINS"))
	trustedProxies := parseCSVEnv(os.Getenv("FUSION_TRUSTED_PROXIES"))

	allowPrivateFeeds, err := getEnvBool("FUSION_ALLOW_PRIVATE_FEEDS", false)
	if err != nil {
		return nil, err
	}

	logLevel := os.Getenv("FUSION_LOG_LEVEL")
	if logLevel == "" {
		logLevel = "INFO"
	}

	logFormat := os.Getenv("FUSION_LOG_FORMAT")
	if logFormat == "" {
		logFormat = "auto"
	}

	return &Config{
		DBPath:             dbPath,
		Password:           password,
		Port:               parsedPort,
		FeverUsername:      getEnvString("FUSION_FEVER_USERNAME", "fusion"),
		CORSAllowedOrigins: corsAllowedOrigins,
		TrustedProxies:     trustedProxies,
		AllowPrivateFeeds:  allowPrivateFeeds,
		PullInterval:       pullInterval,
		PullTimeout:        pullTimeout,
		PullConcurrency:    pullConcurrency,
		PullMaxBackoff:     pullMaxBackoff,
		LoginRateLimit:     loginRateLimit,
		LoginWindow:        loginWindow,
		LoginBlock:         loginBlock,
		LogLevel:           logLevel,
		LogFormat:          logFormat,

		OIDCIssuer:       os.Getenv("FUSION_OIDC_ISSUER"),
		OIDCClientID:     os.Getenv("FUSION_OIDC_CLIENT_ID"),
		OIDCClientSecret: os.Getenv("FUSION_OIDC_CLIENT_SECRET"),
		OIDCRedirectURI:  os.Getenv("FUSION_OIDC_REDIRECT_URI"),
		OIDCAllowedUser:  os.Getenv("FUSION_OIDC_ALLOWED_USER"),

		EmbedderProvider:   os.Getenv("HUB_EMBEDDER_PROVIDER"),
		EmbedderModel:      os.Getenv("HUB_EMBEDDER_MODEL"),
		EmbedderBaseURL:    os.Getenv("HUB_EMBEDDER_BASE_URL"),
		EmbedderAPIKey:     os.Getenv("HUB_EMBEDDER_API_KEY"),
		EmbedderDimensions: inferDimensions(os.Getenv("HUB_EMBEDDER_DIMENSIONS"), os.Getenv("HUB_EMBEDDER_MODEL"), os.Getenv("HUB_EMBEDDER_PROVIDER")),

		GitHubToken:       os.Getenv("GITHUB_TOKEN"),
		GitHubAPIURL:      getEnvString("GITHUB_API_URL", "https://api.github.com"),
		ProductHuntToken:  os.Getenv("PRODUCTHUNT_TOKEN"),
		ProductHuntAPIURL: getEnvString("PRODUCTHUNT_API_URL", "https://api.producthunt.com/v2/api/graphql"),

		PublicURL:        os.Getenv("FUSION_PUBLIC_URL"),
		FusionSourcesJSON: os.Getenv("FUSION_SOURCES_JSON"),
	}, nil
}

func getEnvString(key, defaultVal string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return defaultVal
	}

	return val
}

// firstNonEmpty returns the first non-empty string after trimming. Used
// for env-var alias chains like FUSION_PASSWORD -> HUB_PASSWORD -> PASSWORD.
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func getEnvInt(key string, defaultVal, minVal int) (int, error) {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal, nil
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: %w", key, err)
	}
	if parsed < minVal {
		return 0, fmt.Errorf("invalid %s: must be >= %d", key, minVal)
	}
	return parsed, nil
}

func getEnvBool(key string, defaultVal bool) (bool, error) {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal, nil
	}
	parsed, err := strconv.ParseBool(val)
	if err != nil {
		return false, fmt.Errorf("invalid %s: %w", key, err)
	}
	return parsed, nil
}

// parsePort accepts plain numeric ports and Kubernetes service-link URL values
// such as tcp://10.43.157.55:8080.
func parsePort(val string) (int, error) {
	trimmed := strings.TrimSpace(val)
	parsed, err := strconv.Atoi(trimmed)
	if err == nil {
		return parsed, nil
	}

	if !strings.Contains(trimmed, "://") {
		return 0, err
	}

	parsedURL, err := url.Parse(trimmed)
	if err != nil {
		return 0, err
	}

	port := parsedURL.Port()
	if port == "" {
		return 0, fmt.Errorf("missing port")
	}

	return strconv.Atoi(port)
}

func parseCSVEnv(val string) []string {
	if strings.TrimSpace(val) == "" {
		return nil
	}

	parts := strings.Split(val, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		values = append(values, part)
	}

	if len(values) == 0 {
		return nil
	}

	return values
}

// inferDimensions returns the configured vector size, falling back to model
// name hints, then to a safe default of 1536.
//
// Why a hint: the items.embedding_vec column has a fixed dimension per
// database, and changing it requires an ALTER. We pick the most common
// default (1536) and let users override via HUB_EMBEDDER_DIMENSIONS.
//
// If the user later swaps to a model with a different dim, the search path
// will refuse to compare vectors of mismatched length rather than crash.
func inferDimensions(explicit, model, provider string) int {
	if v := strings.TrimSpace(explicit); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil && n > 0 {
			return n
		}
	}
	if d, ok := modelDimensionHint(model, provider); ok {
		return d
	}
	return 1536
}

// modelDimensionHint returns a known-good vector size for popular embedding
// models. The map is intentionally small — anything unknown falls through
// to the default of 1536.
func modelDimensionHint(model, provider string) (int, bool) {
	m := strings.ToLower(strings.TrimSpace(model))
	p := strings.ToLower(strings.TrimSpace(provider))
	switch {
	case strings.Contains(m, "text-embedding-3-large"):
		return 3072, true
	case strings.Contains(m, "text-embedding-3-small"):
		return 1536, true
	case strings.Contains(m, "text-embedding-ada-002"):
		return 1536, true
	case p == "openai" && m == "":
		return 1536, true // OpenAI default
	case strings.Contains(m, "nomic-embed-text"):
		return 768, true
	case strings.Contains(m, "mxbai-embed-large"):
		return 1024, true
	case strings.Contains(m, "all-minilm"):
		return 384, true
	case strings.Contains(m, "bge-large"):
		return 1024, true
	case strings.Contains(m, "bge-small"):
		return 384, true
	}
	return 0, false
}
