package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"

	"github.com/innate/hub/internal/trending/pkg/github"
	"github.com/innate/hub/internal/trending/pkg/producthunt"
	"github.com/innate/hub/internal/trending/service"
	"github.com/innate/hub/internal/trending/store"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	_ "github.com/jackc/pgx/v5/stdlib"
)

var (
	baseStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240"))

	headerStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("86"))
)

type model struct {
	tabs       []string
	activeTab  int
	width      int
	height     int
	ghSvc      service.GitHubService
	phSvc      service.ProductHuntService
	trending   []table.Row
	starred    []table.Row
	products   []table.Row
	statusMsg  string
}

func initialModel(ghSvc service.GitHubService, phSvc service.ProductHuntService) model {
	return model{
		tabs:      []string{"Trending", "Starred", "Product Hunt"},
		activeTab: 0,
		ghSvc:     ghSvc,
		phSvc:     phSvc,
	}
}

func (m model) Init() tea.Cmd {
	return m.loadTrending
}

type trendingMsg struct {
	rows []table.Row
	err  error
}

func (m model) loadTrending() tea.Msg {
	repos, _, err := m.ghSvc.GetTrending(context.Background(), "daily", "", 50, 0)
	if err != nil {
		return trendingMsg{err: err}
	}
	rows := make([]table.Row, len(repos))
	for i, r := range repos {
		rows[i] = table.Row{r.FullName, r.Language, fmt.Sprintf("%d", r.Stars), fmt.Sprintf("+%d", r.StarsToday)}
	}
	return trendingMsg{rows: rows}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "tab":
			m.activeTab = (m.activeTab + 1) % len(m.tabs)
			if m.activeTab == 0 {
				return m, m.loadTrending
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	case trendingMsg:
		if msg.err != nil {
			m.statusMsg = msg.err.Error()
		} else {
			m.trending = msg.rows
			m.statusMsg = fmt.Sprintf("Loaded %d repos", len(msg.rows))
		}
	}
	return m, nil
}

func (m model) View() string {
	if m.width == 0 {
		return "Loading..."
	}

	var content string
	switch m.activeTab {
	case 0:
		content = m.viewTrending()
	case 1:
		content = "Starred: press 'u' to enter username (not implemented in minimal TUI)"
	case 2:
		content = "Product Hunt (not implemented in minimal TUI)"
	}

	tabs := ""
	for i, t := range m.tabs {
		if i == m.activeTab {
			tabs += headerStyle.Render(" [ "+t+" ] ")
		} else {
			tabs += fmt.Sprintf("  %s  ", t)
		}
	}

	return fmt.Sprintf("%s\n\n%s\n\n%s\n", headerStyle.Render("Innate Hub Trending TUI"), tabs, content) +
		fmt.Sprintf("\n%s  [tab] switch  [q] quit\n", m.statusMsg)
}

func (m model) viewTrending() string {
	if len(m.trending) == 0 {
		return "No trending data. Press 'f' to fetch."
	}

	columns := []table.Column{
		{Title: "Repository", Width: 40},
		{Title: "Language", Width: 15},
		{Title: "Stars", Width: 10},
		{Title: "Today", Width: 10},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithRows(m.trending),
		table.WithHeight(min(len(m.trending), 20)),
	)
	return baseStyle.Render(t.View())
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func main() {
	dbPath := os.Getenv("FUSION_DB_PATH")
	if dbPath == "" {
		dbPath = "fusion.db"
	}

	var dbConn *sql.DB
	var err error
	if strings.HasPrefix(dbPath, "postgres://") || strings.HasPrefix(dbPath, "postgresql://") {
		dbConn, err = sql.Open("pgx", dbPath)
	} else {
		dbConn, err = sql.Open("sqlite", dbPath)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening db: %v\n", err)
		os.Exit(1)
	}

	driver := "sqlite"
	if strings.HasPrefix(dbPath, "postgres://") || strings.HasPrefix(dbPath, "postgresql://") {
		driver = "postgres"
	}

	st, err := store.New(dbConn, driver)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating store: %v\n", err)
		os.Exit(1)
	}
	_ = st.AutoMigrate()

	ghClient := github.NewClient(os.Getenv("GITHUB_TOKEN"), "")
	phClient := producthunt.NewClient(os.Getenv("PRODUCTHUNT_TOKEN"), "")
	ghSvc := service.NewGitHubService(ghClient, st)
	phSvc := service.NewProductHuntService(phClient, st)

	p := tea.NewProgram(initialModel(ghSvc, phSvc), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
