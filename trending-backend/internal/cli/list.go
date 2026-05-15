package cli

import (
	"context"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"trending-backend/internal/services"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(listCmd)
	listCmd.AddCommand(listGitHubTrendingCmd)
	listCmd.AddCommand(listGitHubStarredCmd)
	listCmd.AddCommand(listProductHuntCmd)

	// GitHub trending flags
	listGitHubTrendingCmd.Flags().StringP("period", "p", "daily", "Period: daily, weekly, monthly")
	listGitHubTrendingCmd.Flags().StringP("language", "l", "", "Filter by programming language")
	listGitHubTrendingCmd.Flags().IntP("limit", "n", 30, "Maximum number of repos to show")

	// GitHub starred flags
	listGitHubStarredCmd.Flags().StringP("language", "l", "", "Filter by programming language")
	listGitHubStarredCmd.Flags().IntP("limit", "n", 30, "Maximum number of repos to show")

	// Product Hunt flags
	listProductHuntCmd.Flags().StringP("day", "d", "", "Day in YYYY-MM-DD format (default: today)")
	listProductHuntCmd.Flags().IntP("limit", "n", 30, "Maximum number of products to show")
}

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List stored trending data",
	Long:  `List trending repositories and products stored in the local database.`,
}

var listGitHubTrendingCmd = &cobra.Command{
	Use:   "github-trending",
	Short: "List stored GitHub trending repositories",
	Long:  `Display a table of trending repositories stored in the database.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		period, _ := cmd.Flags().GetString("period")
		language, _ := cmd.Flags().GetString("language")
		limit, _ := cmd.Flags().GetInt("limit")

		svc := services.NewGitHubService()
		repos, total, err := svc.GetTrending(context.Background(), period, language, limit, 0)
		if err != nil {
			return fmt.Errorf("failed to list trending repos: %w", err)
		}

		if len(repos) == 0 {
			fmt.Println("No trending repositories found. Try running 'trending-cli fetch github-trending' first.")
			return nil
		}

		fmt.Printf("GitHub Trending Repositories (period=%s, language=%s, showing %d of %d):\n\n",
			period, language, len(repos), total)

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "REPOSITORY\tLANGUAGE\tSTARS\tSTARS TODAY\tFORKS\tDESCRIPTION")
		fmt.Fprintln(w, "----------\t--------\t-----\t-----------\t-----\t-----------")

		for _, r := range repos {
			desc := truncate(r.Description, 50)
			lang := r.Language
			if lang == "" {
				lang = "-"
			}
			fmt.Fprintf(w, "%s\t%s\t%d\t+%d\t%d\t%s\n",
				r.FullName, lang, r.Stars, r.StarsToday, r.Forks, desc)
		}
		w.Flush()
		return nil
	},
}

var listGitHubStarredCmd = &cobra.Command{
	Use:   "github-starred <username>",
	Short: "List stored starred repositories for a user",
	Long:  `Display a table of starred repositories for a given GitHub user.`,
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		username := args[0]
		language, _ := cmd.Flags().GetString("language")
		limit, _ := cmd.Flags().GetInt("limit")

		svc := services.NewGitHubService()
		repos, total, err := svc.GetStarred(context.Background(), username, language, limit, 0, "starred_at")
		if err != nil {
			return fmt.Errorf("failed to list starred repos: %w", err)
		}

		if len(repos) == 0 {
			fmt.Printf("No starred repositories found for '%s'. Try running 'trending-cli fetch github-starred %s' first.\n",
				username, username)
			return nil
		}

		fmt.Printf("GitHub Starred Repositories for '%s' (language=%s, showing %d of %d):\n\n",
			username, language, len(repos), total)

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "REPOSITORY\tLANGUAGE\tSTARS\tSTARRED AT\tDESCRIPTION")
		fmt.Fprintln(w, "----------\t--------\t-----\t----------\t-----------")

		for _, r := range repos {
			desc := truncate(r.Description, 50)
			lang := r.Language
			if lang == "" {
				lang = "-"
			}
			starredAt := r.StarredAt.Format("2006-01-02")
			fmt.Fprintf(w, "%s\t%s\t%d\t%s\t%s\n",
				r.FullName, lang, r.Stars, starredAt, desc)
		}
		w.Flush()
		return nil
	},
}

var listProductHuntCmd = &cobra.Command{
	Use:   "producthunt",
	Short: "List stored Product Hunt products",
	Long:  `Display a table of Product Hunt products stored in the database.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		day, _ := cmd.Flags().GetString("day")
		limit, _ := cmd.Flags().GetInt("limit")

		svc := services.NewProductHuntService()
		products, total, err := svc.GetTrending(context.Background(), day, limit, 0)
		if err != nil {
			return fmt.Errorf("failed to list products: %w", err)
		}

		if len(products) == 0 {
			fmt.Println("No Product Hunt products found. Try running 'trending-cli fetch producthunt' first.")
			return nil
		}

		fmt.Printf("Product Hunt Products (day=%s, showing %d of %d):\n\n", day, len(products), total)

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NAME\tVOTES\tCOMMENTS\tFEATURED\tTOPICS")
		fmt.Fprintln(w, "----\t-----\t--------\t--------\t------")

		for _, p := range products {
			featured := ""
			if p.Featured {
				featured = "★"
			}
			topics := "-"
			if p.Topics != "" && p.Topics != "null" && p.Topics != "[]" {
				// Quick extraction of topic names from JSON
				topics = extractTopicNames(p.Topics)
				if len(topics) > 40 {
					topics = topics[:37] + "..."
				}
			}
			fmt.Fprintf(w, "%s\t%d\t%d\t%s\t%s\n",
				p.Name, p.VotesCount, p.CommentsCount, featured, topics)
		}
		w.Flush()
		return nil
	},
}

func truncate(s string, maxLen int) string {
	s = strings.TrimSpace(s)
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func extractTopicNames(topicsJSON string) string {
	// Simple extraction of name values from JSON array
	var topics []struct {
		Name string `json:"name"`
	}
	// Very naive approach - just extract quoted strings after "name":
	var names []string
	parts := strings.Split(topicsJSON, `"name":`)
	for i, part := range parts {
		if i == 0 {
			continue
		}
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, `"`) {
			end := strings.Index(part[1:], `"`)
			if end >= 0 {
				names = append(names, part[1:end+1])
			}
		}
	}
	if len(names) > 0 {
		return strings.Join(names, ", ")
	}
	_ = topics
	return "-"
}
