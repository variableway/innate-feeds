package main

import (
	"fmt"
	"os"

	"trending-backend/internal/config"
	"trending-backend/internal/db"
	"trending-backend/internal/tui"
)

func main() {
	// Initialize config and database before starting TUI
	_ = config.Get()
	_ = db.Get()

	if err := tui.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
