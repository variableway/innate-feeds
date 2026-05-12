package cli

import (
	"log/slog"
	"os"

	"trending-backend/internal/config"
	"trending-backend/internal/db"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "trending-cli",
	Short: "Trending Aggregator CLI",
	Long: `A CLI tool for fetching and browsing trending GitHub repositories
and Product Hunt products. Provides commands for data fetching, listing,
and starting the API server.`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		// Initialize config and database for all commands
		_ = config.Get()
		_ = db.Get()
		slog.Info("configuration and database initialized")
	},
	SilenceUsage: true,
}

// Execute runs the CLI application.
func Execute() error {
	// Set up logging
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	return rootCmd.Execute()
}
