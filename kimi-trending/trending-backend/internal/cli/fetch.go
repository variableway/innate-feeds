package cli

import (
	"context"
	"fmt"
	"log/slog"

	"trending-backend/internal/services"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(fetchCmd)
	fetchCmd.AddCommand(fetchGitHubTrendingCmd)
	fetchCmd.AddCommand(fetchGitHubStarredCmd)
	fetchCmd.AddCommand(fetchProductHuntCmd)

	// GitHub trending flags
	fetchGitHubTrendingCmd.Flags().StringP("period", "p", "daily", "Period: daily, weekly, monthly")
	fetchGitHubTrendingCmd.Flags().StringP("language", "l", "", "Filter by programming language")
	fetchGitHubTrendingCmd.Flags().IntP("limit", "n", 100, "Maximum number of repos to fetch")

	// GitHub starred flags
	fetchGitHubStarredCmd.Flags().IntP("limit", "n", 100, "Maximum number of starred repos to fetch")

	// Product Hunt flags
	fetchProductHuntCmd.Flags().StringP("day", "d", "", "Day in YYYY-MM-DD format (default: today)")
	fetchProductHuntCmd.Flags().IntP("limit", "n", 100, "Maximum number of products to fetch")
}

var fetchCmd = &cobra.Command{
	Use:   "fetch",
	Short: "Fetch trending data from external APIs",
	Long:  `Fetch trending repositories from GitHub and products from Product Hunt, storing results in the local database.`,
}

var fetchGitHubTrendingCmd = &cobra.Command{
	Use:   "github-trending",
	Short: "Fetch trending GitHub repositories",
	Long:  `Fetch trending repositories from GitHub's trending page and store them in the database.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		period, _ := cmd.Flags().GetString("period")
		language, _ := cmd.Flags().GetString("language")
		limit, _ := cmd.Flags().GetInt("limit")

		fmt.Printf("Fetching GitHub trending repos (period=%s, language=%s, limit=%d)...\n", period, language, limit)

		svc := services.NewGitHubService()
		repos, err := svc.FetchTrending(context.Background(), period, language, limit)
		if err != nil {
			return fmt.Errorf("failed to fetch trending repos: %w", err)
		}

		fmt.Printf("Successfully fetched and stored %d trending repositories.\n", len(repos))
		for i, r := range repos {
			if i >= 10 {
				fmt.Printf("... and %d more\n", len(repos)-10)
				break
			}
			fmt.Printf("  %-40s ⭐ %d (+%d today)\n", r.FullName, r.Stars, r.StarsToday)
		}

		slog.Info("fetch github-trending complete", "count", len(repos), "period", period)
		return nil
	},
}

var fetchGitHubStarredCmd = &cobra.Command{
	Use:   "github-starred <username>",
	Short: "Fetch starred repositories for a GitHub user",
	Long:  `Fetch all starred repositories for a given GitHub username and store them in the database.`,
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		username := args[0]
		limit, _ := cmd.Flags().GetInt("limit")

		fmt.Printf("Fetching starred repos for user '%s' (limit=%d)...\n", username, limit)

		svc := services.NewGitHubService()
		repos, err := svc.FetchUserStarred(context.Background(), username, limit)
		if err != nil {
			return fmt.Errorf("failed to fetch starred repos: %w", err)
		}

		fmt.Printf("Successfully fetched and stored %d starred repositories for '%s'.\n", len(repos), username)
		for i, r := range repos {
			if i >= 10 {
				fmt.Printf("... and %d more\n", len(repos)-10)
				break
			}
			fmt.Printf("  %-40s ⭐ %d\n", r.FullName, r.Stars)
		}

		slog.Info("fetch github-starred complete", "count", len(repos), "username", username)
		return nil
	},
}

var fetchProductHuntCmd = &cobra.Command{
	Use:   "producthunt",
	Short: "Fetch trending Product Hunt products",
	Long:  `Fetch trending products from Product Hunt for a given day and store them in the database.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		day, _ := cmd.Flags().GetString("day")
		limit, _ := cmd.Flags().GetInt("limit")

		if day == "" {
			fmt.Printf("Fetching trending Product Hunt products for today (limit=%d)...\n", limit)
		} else {
			fmt.Printf("Fetching trending Product Hunt products for %s (limit=%d)...\n", day, limit)
		}

		svc := services.NewProductHuntService()
		products, err := svc.FetchTrending(context.Background(), day, limit)
		if err != nil {
			return fmt.Errorf("failed to fetch producthunt products: %w", err)
		}

		fmt.Printf("Successfully fetched and stored %d products.\n", len(products))
		for i, p := range products {
			if i >= 10 {
				fmt.Printf("... and %d more\n", len(products)-10)
				break
			}
			fmt.Printf("  %-30s 👍 %d  💬 %d\n", p.Name, p.VotesCount, p.CommentsCount)
		}

		slog.Info("fetch producthunt complete", "count", len(products), "day", day)
		return nil
	},
}
