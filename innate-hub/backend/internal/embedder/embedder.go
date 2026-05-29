// Package embedder provides text-to-vector (embedding) generation for
// semantic search. Multiple backends are supported: OpenAI, Ollama,
// and a no-op fallback.
package embedder

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
)

// Embedder converts text into dense vector representations.
type Embedder interface {
	// Embed generates embeddings for the given texts in a single batch call.
	// Returns one vector per input text. All vectors have the same dimension.
	Embed(ctx context.Context, texts []string) ([][]float32, error)
	// Dimensions returns the vector size (e.g. 384, 768, 1536).
	Dimensions() int
}

// Config holds common embedder configuration.
type Config struct {
	// Provider: "openai", "ollama", or "" (disabled)
	Provider string
	// Model name, provider-specific.
	// OpenAI: "text-embedding-3-small" (1536d), "text-embedding-3-large" (3072d)
	// Ollama: "nomic-embed-text" (768d), "mxbai-embed-large" (1024d)
	Model string
	// API base URL. Defaults depend on provider.
	BaseURL string
	// API key. Required for OpenAI; optional for local Ollama.
	APIKey string
}

// New creates an embedder from config. Returns nil (disabled) if Provider is empty.
func New(cfg Config) (Embedder, error) {
	switch cfg.Provider {
	case "openai":
		return NewOpenAI(cfg)
	case "ollama":
		return NewOllama(cfg)
	case "":
		return nil, nil
	default:
		return nil, fmt.Errorf("unknown embedder provider: %s", cfg.Provider)
	}
}

// CosineSimilarity computes the cosine similarity between two vectors.
// Returns a value in [-1, 1]; higher means more similar.
func CosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) {
		return -1
	}
	var dot, normA, normB float64
	for i := range a {
		xa := float64(a[i])
		xb := float64(b[i])
		dot += xa * xb
		normA += xa * xa
		normB += xb * xb
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

// EncodeFloat32 serializes a []float32 into a byte slice (little-endian).
func EncodeFloat32(v []float32) []byte {
	buf := make([]byte, len(v)*4)
	for i, f := range v {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
	}
	return buf
}

// DecodeFloat32 deserializes a byte slice into []float32 (little-endian).
func DecodeFloat32(buf []byte) []float32 {
	n := len(buf) / 4
	v := make([]float32, n)
	for i := 0; i < n; i++ {
		bits := binary.LittleEndian.Uint32(buf[i*4:])
		v[i] = math.Float32frombits(bits)
	}
	return v
}
