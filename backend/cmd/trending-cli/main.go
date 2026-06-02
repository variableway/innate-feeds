package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/innate/hub/internal/trending/pkg/github"
	"github.com/innate/hub/internal/trending/pkg/producthunt"
	"github.com/innate/hub/internal/trending/service"
	"github.com/innate/hub/internal/trending/store"
	"github.com/spf13/cobra"
	_ "github.com/jackc/pgx/v5/stdlib"
)

var (
	dbPath string
	token  string
)

var rootCmd = &cobra.Command{
	Use:   "trending-cli",
	Short: "Trending Aggregator CLI",
	Long:  `A CLI tool for fetching and browsing trending GitHub repositories and Product Hunt products.`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})))
	},
	SilenceUsage: true,
}

func main() {
	rootCmd.PersistentFlags().StringVar(&dbPath, "db", "fusion.db", "Database path (SQLite) or DSN (PostgreSQL)")

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func openStore() (*store.TrendingStore, error) {
	var db *sql.DB
	var err error
	if strings.HasPrefix(dbPath, "postgres://") || strings.HasPrefix(dbPath, "postgresql://") {
		db, err = sql.Open("pgx", dbPath)
	} else {
		db, err = sql.Open("sqlite", dbPath)
	}
	if err != nil {
		return nil, err
	}

	driver := "sqlite"
	if strings.HasPrefix(dbPath, "postgres://") || strings.HasPrefix(dbPath, "postgresql://") {
		driver = "postgres"
	}

	st, err := store.New(db, driver)
	if err != nil {
		return nil, err
	}
	if err := st.AutoMigrate(); err != nil {
		return nil, err
	}
	return st, nil
}

func newGitHubSvc(st *store.TrendingStore) service.GitHubService {
	token := os.Getenv("GITHUB_TOKEN")
	client := github.NewClient(token, "")
	return service.NewGitHubService(client, st)
}

func newProductHuntSvc(st *store.TrendingStore) service.ProductHuntService {
	token := os.Getenv("PRODUCTHUNT_TOKEN")
	client := producthunt.NewClient(token, "")
	return service.NewProductHuntService(client, st)
}

// --- fetch commands ---

var fetchCmd = &cobra.Command{
	Use:   "fetch",
	Short: "Fetch trending data from external APIs",
}

var fetchGitHubTrendingCmd = &cobra.Command{
	Use:   "github-trending",
	Short: "Fetch trending GitHub repositories",
	RunE: func(cmd *cobra.Command, args []string) error {
		period, _ := cmd.Flags().GetString("period")
		language, _ := cmd.Flags().GetString("language")
		limit, _ := cmd.Flags().GetInt("limit")

		st, err := openStore()
		if err != nil {
			return err
		}

		repos, err := newGitHubSvc(st).FetchTrending(context.Background(), period, language, limit)
		if err != nil {
			return err
		}
		fmt.Printf("Fetched %d trending repos\n", len(repos))
		return nil
	},
}

var fetchGitHubStarredCmd = &cobra.Command{
	Use:   "github-starred <username>",
	Short: "Fetch starred repositories for a GitHub user",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		username := args[0]
		limit, _ := cmd.Flags().GetInt("limit")

		st, err := openStore()
		if err != nil {
			return err
		}

		repos, err := newGitHubSvc(st).FetchUserStarred(context.Background(), username, limit)
		if err != nil {
			return err
		}
		fmt.Printf("Fetched %d starred repos for %s\n", len(repos), username)
		return nil
	},
}

var fetchProductHuntCmd = &cobra.Command{
	Use:   "producthunt",
	Short: "Fetch trending Product Hunt products",
	RunE: func(cmd *cobra.Command, args []string) error {
		day, _ := cmd.Flags().GetString("day")
		limit, _ := cmd.Flags().GetInt("limit")

		st, err := openStore()
		if err != nil {
			return err
		}

		products, err := newProductHuntSvc(st).FetchTrending(context.Background(), day, limit)
		if err != nil {
			return err
		}
		fmt.Printf("Fetched %d Product Hunt products\n", len(products))
		return nil
	},
}

// --- list commands ---

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List stored trending data",
}

var listGitHubTrendingCmd = &cobra.Command{
	Use:   "github-trending",
	Short: "List stored GitHub trending repositories",
	RunE: func(cmd *cobra.Command, args []string) error {
		period, _ := cmd.Flags().GetString("period")
		language, _ := cmd.Flags().GetString("language")
		limit, _ := cmd.Flags().GetInt("limit")

		st, err := openStore()
		if err != nil {
			return err
		}

		repos, total, err := newGitHubSvc(st).GetTrending(context.Background(), period, language, limit, 0)
		if err != nil {
			return err
		}

		fmt.Printf("GitHub Trending (showing %d of %d):\n\n", len(repos), total)
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "REPOSITORY\tLANGUAGE\tSTARS\tSTARS TODAY\tFORKS")
		for _, r := range repos {
			fmt.Fprintf(w, "%s\t%s\t%d\t+%d\t%d\n", r.FullName, r.Language, r.Stars, r.StarsToday, r.Forks)
		}
		w.Flush()
		return nil
	},
}

var listGitHubStarredCmd = &cobra.Command{
	Use:   "github-starred <username>",
	Short: "List stored starred repositories for a user",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		username := args[0]
		language, _ := cmd.Flags().GetString("language")
		limit, _ := cmd.Flags().GetInt("limit")

		st, err := openStore()
		if err != nil {
			return err
		}

		repos, total, err := newGitHubSvc(st).GetStarred(context.Background(), username, language, limit, 0, "starred_at")
		if err != nil {
			return err
		}

		fmt.Printf("Starred for %s (showing %d of %d):\n\n", username, len(repos), total)
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "REPOSITORY\tLANGUAGE\tSTARS")
		for _, r := range repos {
			fmt.Fprintf(w, "%s\t%s\t%d\n", r.FullName, r.Language, r.Stars)
		}
		w.Flush()
		return nil
	},
}

var listProductHuntCmd = &cobra.Command{
	Use:   "producthunt",
	Short: "List stored Product Hunt products",
	RunE: func(cmd *cobra.Command, args []string) error {
		day, _ := cmd.Flags().GetString("day")
		limit, _ := cmd.Flags().GetInt("limit")

		st, err := openStore()
		if err != nil {
			return err
		}

		products, total, err := newProductHuntSvc(st).GetTrending(context.Background(), day, limit, 0)
		if err != nil {
			return err
		}

		fmt.Printf("Product Hunt (showing %d of %d):\n\n", len(products), total)
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NAME\tVOTES\tCOMMENTS")
		for _, p := range products {
			fmt.Fprintf(w, "%s\t%d\t%d\n", p.Name, p.VotesCount, p.CommentsCount)
		}
		w.Flush()
		return nil
	},
}

func init() {
	rootCmd.AddCommand(fetchCmd, listCmd)

	fetchCmd.AddCommand(fetchGitHubTrendingCmd, fetchGitHubStarredCmd, fetchProductHuntCmd)
	fetchGitHubTrendingCmd.Flags().StringP("period", "p", "daily", "Period: daily, weekly, monthly")
	fetchGitHubTrendingCmd.Flags().StringP("language", "l", "", "Filter by language")
	fetchGitHubTrendingCmd.Flags().IntP("limit", "n", 100, "Max repos to fetch")
	fetchGitHubStarredCmd.Flags().IntP("limit", "n", 100, "Max repos to fetch")
	fetchProductHuntCmd.Flags().StringP("day", "d", "", "Day YYYY-MM-DD")
	fetchProductHuntCmd.Flags().IntP("limit", "n", 100, "Max products to fetch")

	listCmd.AddCommand(listGitHubTrendingCmd, listGitHubStarredCmd, listProductHuntCmd)
	listGitHubTrendingCmd.Flags().StringP("period", "p", "daily", "Period")
	listGitHubTrendingCmd.Flags().StringP("language", "l", "", "Filter by language")
	listGitHubTrendingCmd.Flags().IntP("limit", "n", 30, "Max repos to show")
	listGitHubStarredCmd.Flags().StringP("language", "l", "", "Filter by language")
	listGitHubStarredCmd.Flags().IntP("limit", "n", 30, "Max repos to show")
	listProductHuntCmd.Flags().StringP("day", "d", "", "Day YYYY-MM-DD")
	listProductHuntCmd.Flags().IntP("limit", "n", 30, "Max products to show")
}
