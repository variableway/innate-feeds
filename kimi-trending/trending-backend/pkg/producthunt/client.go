package producthunt

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/go-resty/resty/v2"
)

// Product represents a Product Hunt post.
type Product struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Tagline       string `json:"tagline"`
	Description   string `json:"description"`
	URL           string `json:"url"`
	Thumbnail     string `json:"thumbnail"`
	VotesCount    int    `json:"votesCount"`
	CommentsCount int    `json:"commentsCount"`
	Featured      bool   `json:"featured"`
	Day           string `json:"day"`
	Makers        []struct {
		Name     string `json:"name"`
		Username string `json:"username"`
	} `json:"makers"`
	Topics []struct {
		Name string `json:"name"`
	} `json:"topics"`
}

// Client wraps interactions with the Product Hunt API v2.
type Client struct {
	resty   *resty.Client
	baseURL string
}

// NewClient creates a new Product Hunt client.
func NewClient(token, baseURL string) *Client {
	if baseURL == "" {
		baseURL = "https://api.producthunt.com/v2/api/graphql"
	}
	client := resty.New()
	client.SetBaseURL(baseURL)
	client.SetTimeout(30 * time.Second)

	if token != "" {
		client.SetHeader("Authorization", "Bearer "+token)
	}

	return &Client{
		resty:   client,
		baseURL: baseURL,
	}
}

// GetTrending fetches trending posts from Product Hunt for a given day.
func (c *Client) GetTrending(ctx context.Context, day string, count int) ([]Product, error) {
	if count <= 0 {
		count = 30
	}

	// Use today's date if not specified
	if day == "" {
		day = time.Now().Format("2006-01-02")
	}

	query := fmt.Sprintf(`
		query {
			posts(order: RANKING, first: %d, postedAfter: "%sT00:00:00Z", postedBefore: "%sT23:59:59Z") {
				nodes {
					id
					name
					tagline
					description
					url
					thumbnail {
						url
					}
					votesCount
					commentsCount
					featured
					makers {
						name
						username
					}
					topics {
						nodes {
							name
						}
					}
					createdAt
				}
			}
		}
	`, count, day, day)

	type graphqlReq struct {
		Query string `json:"query"`
	}

	resp, err := c.resty.R().
		SetContext(ctx).
		SetHeader("Content-Type", "application/json").
		SetBody(graphqlReq{Query: query}).
		Post("")

	if err != nil {
		return nil, fmt.Errorf("producthunt API request: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("producthunt API returned status %d: %s", resp.StatusCode(), resp.String())
	}

	var result struct {
		Data struct {
			Posts struct {
				Nodes []struct {
					ID            string `json:"id"`
					Name          string `json:"name"`
					Tagline       string `json:"tagline"`
					Description   string `json:"description"`
					URL           string `json:"url"`
					Thumbnail     struct {
						URL string `json:"url"`
					} `json:"thumbnail"`
					VotesCount    int    `json:"votesCount"`
					CommentsCount int    `json:"commentsCount"`
					Featured      bool   `json:"featured"`
					Makers        []struct {
						Name     string `json:"name"`
						Username string `json:"username"`
					} `json:"makers"`
					Topics struct {
						Nodes []struct {
							Name string `json:"name"`
						} `json:"nodes"`
					} `json:"topics"`
					CreatedAt string `json:"createdAt"`
				} `json:"nodes"`
			} `json:"posts"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.Unmarshal(resp.Body(), &result); err != nil {
		return nil, fmt.Errorf("unmarshaling response: %w", err)
	}

	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("GraphQL error: %s", result.Errors[0].Message)
	}

	var products []Product
	for _, node := range result.Data.Posts.Nodes {
		topics := make([]struct {
			Name string `json:"name"`
		}, len(node.Topics.Nodes))
		for i, t := range node.Topics.Nodes {
			topics[i] = struct {
				Name string `json:"name"`
			}{Name: t.Name}
		}

		products = append(products, Product{
			ID:            node.ID,
			Name:          node.Name,
			Tagline:       node.Tagline,
			Description:   node.Description,
			URL:           node.URL,
			Thumbnail:     node.Thumbnail.URL,
			VotesCount:    node.VotesCount,
			CommentsCount: node.CommentsCount,
			Featured:      node.Featured,
			Day:           day,
			Makers:        node.Makers,
			Topics:        topics,
		})
	}

	slog.Info("fetched Product Hunt trending", "count", len(products), "day", day)
	return products, nil
}
