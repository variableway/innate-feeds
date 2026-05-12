package cli

import (
	"fmt"
	"os"
	"text/tabwriter"

	"trending-backend/internal/config"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configShowCmd)
}

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage configuration",
	Long:  `View and manage application configuration settings.`,
}

var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Display current configuration",
	Long:  `Show all current configuration values loaded from environment variables.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg := config.Get()

		fmt.Println("Current Configuration")
		fmt.Println("=====================\n")

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 4, ' ', 0)

		fmt.Fprintln(w, "SECTION\tKEY\tVALUE")
		fmt.Fprintln(w, "-------\t---\t-----")

		// Database
		fmt.Fprintf(w, "Database\tDB_DRIVER\t%s\n", cfg.DBDriver)
		fmt.Fprintf(w, "Database\tDB_HOST\t%s\n", cfg.DBHost)
		fmt.Fprintf(w, "Database\tDB_PORT\t%d\n", cfg.DBPort)
		fmt.Fprintf(w, "Database\tDB_USER\t%s\n", cfg.DBUser)
		fmt.Fprintf(w, "Database\tDB_NAME\t%s\n", cfg.DBName)
		fmt.Fprintf(w, "Database\tDB_SSL_MODE\t%s\n", cfg.DBSSLMode)

		// API Server
		fmt.Fprintf(w, "API Server\tAPI_HOST\t%s\n", cfg.APIHost)
		fmt.Fprintf(w, "API Server\tAPI_PORT\t%d\n", cfg.APIPort)
		fmt.Fprintf(w, "API Server\tAPI_READ_TIMEOUT\t%d\n", cfg.APIReadTimeout)
		fmt.Fprintf(w, "API Server\tAPI_WRITE_TIMEOUT\t%d\n", cfg.APIWriteTimeout)

		// GitHub
		token := cfg.GitHubToken
		if token != "" {
			if len(token) > 12 {
				token = token[:4] + "..." + token[len(token)-4:]
			} else {
				token = "***"
			}
		} else {
			token = "(not set)"
		}
		fmt.Fprintf(w, "GitHub\tGITHUB_TOKEN\t%s\n", token)
		fmt.Fprintf(w, "GitHub\tGITHUB_API_URL\t%s\n", cfg.GitHubAPIURL)

		// Product Hunt
		phToken := cfg.ProductHuntToken
		if phToken != "" {
			if len(phToken) > 12 {
				phToken = phToken[:4] + "..." + phToken[len(phToken)-4:]
			} else {
				phToken = "***"
			}
		} else {
			phToken = "(not set)"
		}
		fmt.Fprintf(w, "Product Hunt\tPRODUCTHUNT_TOKEN\t%s\n", phToken)
		fmt.Fprintf(w, "Product Hunt\tPRODUCTHUNT_API_URL\t%s\n", cfg.ProductHuntAPIURL)

		// Scheduler
		fmt.Fprintf(w, "Scheduler\tFETCH_INTERVAL\t%d seconds\n", cfg.FetchInterval)

		// TUI
		fmt.Fprintf(w, "TUI\tTUI_REFRESH_RATE\t%d seconds\n", cfg.TUIRefreshRate)

		// Derived
		fmt.Fprintf(w, "Derived\tDatabase DSN\t%s\n", cfg.DatabaseDSN())
		fmt.Fprintf(w, "Derived\tAPI Address\t%s\n", cfg.APIAddress())

		w.Flush()
		return nil
	},
}
