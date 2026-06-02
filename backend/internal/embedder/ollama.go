package embedder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type OllamaEmbedder struct {
	baseURL string
	model   string
	dims    int
	client  *http.Client
}

func NewOllama(cfg Config) (*OllamaEmbedder, error) {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	model := cfg.Model
	if model == "" {
		model = "nomic-embed-text"
	}

	// Dimensions are model-dependent. We attempt to detect via a probe request,
	// otherwise fall back to known defaults.
	e := &OllamaEmbedder{
		baseURL: baseURL,
		model:   model,
		client:  &http.Client{Timeout: 60 * time.Second},
	}

	// Probe for dimensions.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	vec, err := e.embedSingle(ctx, []string{"probe"})
	if err == nil && len(vec) > 0 && len(vec[0]) > 0 {
		e.dims = len(vec[0])
	} else {
		// Known defaults.
		switch model {
		case "nomic-embed-text":
			e.dims = 768
		case "mxbai-embed-large":
			e.dims = 1024
		case "all-minilm":
			e.dims = 384
		default:
			e.dims = 768
		}
	}

	return e, nil
}

func (e *OllamaEmbedder) Dimensions() int {
	return e.dims
}

func (e *OllamaEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	return e.embedSingle(ctx, texts)
}

func (e *OllamaEmbedder) embedSingle(ctx context.Context, texts []string) ([][]float32, error) {
	results := make([][]float32, 0, len(texts))

	// Ollama embedding endpoint processes one text at a time.
	for _, text := range texts {
		body, _ := json.Marshal(map[string]any{
			"model":  e.model,
			"prompt": text,
		})

		req, err := http.NewRequestWithContext(ctx, "POST", e.baseURL+"/api/embeddings", bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := e.client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("ollama request: %w", err)
		}

		var result struct {
			Embedding []float32 `json:"embedding"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("decode ollama response: %w", err)
		}
		resp.Body.Close()

		results = append(results, result.Embedding)
	}

	return results, nil
}
