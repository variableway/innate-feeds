package embedder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type OpenAIEmbedder struct {
	apiKey  string
	baseURL string
	model   string
	dims    int
	client  *http.Client
}

func NewOpenAI(cfg Config) (*OpenAIEmbedder, error) {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	model := cfg.Model
	if model == "" {
		model = "text-embedding-3-small"
	}

	dims := 1536
	if model == "text-embedding-3-large" {
		dims = 3072
	}

	if cfg.APIKey == "" {
		return nil, fmt.Errorf("openai embedder requires API key")
	}

	return &OpenAIEmbedder{
		apiKey:  cfg.APIKey,
		baseURL: baseURL,
		model:   model,
		dims:    dims,
		client:  &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (e *OpenAIEmbedder) Dimensions() int {
	return e.dims
}

func (e *OpenAIEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	// OpenAI supports up to 2048 texts per request; chunk if larger.
	const maxBatch = 2048
	if len(texts) > maxBatch {
		return e.embedBatched(ctx, texts, maxBatch)
	}

	return e.embedSingle(ctx, texts)
}

func (e *OpenAIEmbedder) embedBatched(ctx context.Context, texts []string, batchSize int) ([][]float32, error) {
	results := make([][]float32, 0, len(texts))
	for i := 0; i < len(texts); i += batchSize {
		end := i + batchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch, err := e.embedSingle(ctx, texts[i:end])
		if err != nil {
			return nil, err
		}
		results = append(results, batch...)
	}
	return results, nil
}

func (e *OpenAIEmbedder) embedSingle(ctx context.Context, texts []string) ([][]float32, error) {
	body, _ := json.Marshal(map[string]any{
		"model": e.model,
		"input": texts,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", e.baseURL+"/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openai error: HTTP %d", resp.StatusCode)
	}

	var result struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
			Index     int       `json:"index"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode openai response: %w", err)
	}

	// Ensure output order matches input order.
	vectors := make([][]float32, len(texts))
	for _, d := range result.Data {
		if d.Index >= 0 && d.Index < len(vectors) {
			vectors[d.Index] = d.Embedding
		}
	}
	return vectors, nil
}
