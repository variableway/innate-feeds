package tui

import (
	"context"
	"fmt"

	"trending-backend/internal/models"
	"trending-backend/internal/services"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// trendingModel represents the GitHub Trending tab.
type trendingModel struct {
	width  int
	height int

	// Data
	repos      []models.GitHubTrending
	languages  []string
	total      int64
	selected   int
	offset     int

	// Filters
	period      string
	language    string
	searchMode  bool
	searchQuery string

	// Loading state
	loading bool
	err     error
}

func newTrendingModel() trendingModel {
	return trendingModel{
		period: "daily",
	}
}

func (t *trendingModel) setSize(w, h int) {
	t.width = w
	t.height = h
}

func (t trendingModel) Init() tea.Cmd {
	return t.onFocus()
}

func (t trendingModel) Update(msg tea.Msg) (trendingModel, tea.Cmd) {
	switch msg := msg.(type) {
	case trendingDataMsg:
		t.loading = false
		if msg.err != nil {
			t.err = msg.err
		} else {
			t.repos = msg.repos
			t.total = msg.total
			t.selected = 0
			t.offset = 0
			t.err = nil
		}
		return t, nil

	case languagesMsg:
		if msg.err == nil {
			t.languages = msg.languages
		}
		return t, nil

	case tea.KeyMsg:
		if t.searchMode {
			switch msg.String() {
			case "esc":
				t.searchMode = false
				t.searchQuery = ""
				return t, t.loadData()
			case "enter":
				t.searchMode = false
				return t, nil
			case "backspace":
				if len(t.searchQuery) > 0 {
					t.searchQuery = t.searchQuery[:len(t.searchQuery)-1]
				}
				return t, nil
			case " ":
				t.searchQuery += " "
				return t, nil
			default:
				if len(msg.String()) == 1 {
					t.searchQuery += msg.String()
				}
				return t, nil
			}
		}

		switch msg.String() {
		case "up", "k":
			if t.selected > 0 {
				t.selected--
			}
			if t.selected < t.offset {
				t.offset = t.selected
			}
			return t, nil

		case "down", "j":
			if t.selected < len(t.repos)-1 {
				t.selected++
			}
			visibleRows := t.visibleRows()
			if t.selected >= t.offset+visibleRows {
				t.offset = t.selected - visibleRows + 1
			}
			return t, nil

		case "enter":
			if t.selected < len(t.repos) {
				repo := t.repos[t.selected]
				_ = repo.URL
			}
			return t, nil

		case "1":
			t.period = "daily"
			return t, t.loadData()
		case "2":
			t.period = "weekly"
			return t, t.loadData()
		case "3":
			t.period = "monthly"
			return t, t.loadData()

		case "l":
			if len(t.languages) > 0 {
				found := false
				for i, lang := range t.languages {
					if found {
						t.language = lang
						return t, t.loadData()
					}
					if lang == t.language {
						found = true
					}
				}
				t.language = t.languages[0]
				return t, t.loadData()
			}
			return t, nil

		case "r":
			return t, t.loadData()

		case "f":
			return t, t.fetchData()

		case "/":
			t.searchMode = true
			t.searchQuery = ""
			return t, nil
		}
	}

	return t, nil
}

func (t trendingModel) View() string {
	if t.width < 40 {
		return "Window too small"
	}

	var parts []string

	parts = append(parts, titleStyle.Render("GitHub Trending Repositories"))

	filterInfo := fmt.Sprintf("  Period: [1] %s [2] %s [3] %s | Language: %s | Total: %d",
		formatPeriodActive("daily", t.period),
		formatPeriodActive("weekly", t.period),
		formatPeriodActive("monthly", t.period),
		formatLanguage(t.language),
		t.total,
	)
	parts = append(parts, subtitleStyle.Render(filterInfo))

	if t.searchMode {
		parts = append(parts, "")
		parts = append(parts, inputStyle.Width(t.width-4).Render("Search: "+t.searchQuery+"_"))
	}

	parts = append(parts, "")

	parts = append(parts, t.renderHeader())

	if t.loading {
		parts = append(parts, "  Loading...")
	} else if t.err != nil {
		parts = append(parts, errorStyle.Render("  Error: "+t.err.Error()))
	} else if len(t.repos) == 0 {
		parts = append(parts, "  No repositories found. Press 'f' to fetch data.")
	} else {
		visibleRows := t.visibleRows()
		end := t.offset + visibleRows
		if end > len(t.repos) {
			end = len(t.repos)
		}

		for i := t.offset; i < end; i++ {
			parts = append(parts, t.renderRow(i))
		}

		parts = append(parts, "")
		pageInfo := fmt.Sprintf("  Showing %d-%d of %d (j/k or arrows to navigate, Enter to open)",
			t.offset+1, end, t.total)
		parts = append(parts, helpStyle.Render(pageInfo))
	}

	return lipgloss.JoinVertical(lipgloss.Left, parts...)
}

func (t trendingModel) renderHeader() string {
	cols := []string{"REPOSITORY", "LANGUAGE", "STARS", "STARS TODAY", "FORKS"}
	widths := t.columnWidths()

	var cells []string
	for i, col := range cols {
		w := widths[i]
		if w > 0 {
			cells = append(cells, tableHeaderStyle.Width(w).Render(truncateString(col, w)))
		}
	}

	return lipgloss.JoinHorizontal(lipgloss.Left, cells...)
}

func (t trendingModel) renderRow(idx int) string {
	repo := t.repos[idx]
	widths := t.columnWidths()

	style := tableRowStyle
	if idx%2 == 1 {
		style = tableRowAltStyle
	}
	if idx == t.selected {
		style = tableRowSelectedStyle
	}

	lang := repo.Language
	if lang == "" {
		lang = "-"
	}

	cells := []string{
		style.Width(widths[0]).Render(truncateString(repo.FullName, widths[0])),
		languageStyle.Width(widths[1]).Render(truncateString(lang, widths[1])),
		starStyle.Width(widths[2]).Render(fmt.Sprintf("%d", repo.Stars)),
		starStyle.Width(widths[3]).Render(fmt.Sprintf("+%d", repo.StarsToday)),
		forkStyle.Width(widths[4]).Render(fmt.Sprintf("%d", repo.Forks)),
	}

	return lipgloss.JoinHorizontal(lipgloss.Left, cells...)
}

func (t trendingModel) columnWidths() []int {
	availWidth := t.width - 6
	if availWidth < 60 {
		availWidth = 60
	}

	return []int{
		availWidth * 35 / 100,
		availWidth * 18 / 100,
		availWidth * 16 / 100,
		availWidth * 16 / 100,
		availWidth * 15 / 100,
	}
}

func (t trendingModel) visibleRows() int {
	availHeight := t.height - 10
	if availHeight < 3 {
		availHeight = 3
	}
	return availHeight
}

func (t trendingModel) onFocus() tea.Cmd {
	return tea.Batch(
		t.loadLanguages(),
		t.loadData(),
	)
}

// loadData returns a command that loads trending data from DB.
func (t trendingModel) loadData() tea.Cmd {
	period := t.period
	language := t.language
	limit := t.visibleRows()
	return func() tea.Msg {
		svc := services.NewGitHubService()
		repos, total, err := svc.GetTrending(context.Background(), period, language, limit, 0)
		if err != nil {
			return trendingDataMsg{err: err}
		}
		return trendingDataMsg{repos: repos, total: total}
	}
}

// fetchData returns a command that fetches new trending data from GitHub.
func (t trendingModel) fetchData() tea.Cmd {
	period := t.period
	language := t.language
	return func() tea.Msg {
		svc := services.NewGitHubService()
		repos, err := svc.FetchTrending(context.Background(), period, language, 100)
		if err != nil {
			return trendingDataMsg{err: err}
		}
		return trendingDataMsg{repos: repos, total: int64(len(repos))}
	}
}

func (t trendingModel) loadLanguages() tea.Cmd {
	return func() tea.Msg {
		svc := services.NewGitHubService()
		langs, err := svc.GetLanguages(context.Background())
		return languagesMsg{languages: langs, err: err}
	}
}

func formatPeriodActive(period, current string) string {
	if period == current {
		return lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colorIndigo400)).Render(period)
	}
	return period
}

func formatLanguage(lang string) string {
	if lang == "" {
		return "(all)"
	}
	return lang
}

func truncateString(s string, maxLen int) string {
	if maxLen <= 0 {
		return s
	}
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
