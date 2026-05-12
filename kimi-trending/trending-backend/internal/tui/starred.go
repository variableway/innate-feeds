package tui

import (
	"context"
	"fmt"
	"sort"

	"trending-backend/internal/models"
	"trending-backend/internal/services"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// starredModel represents the GitHub Starred tab.
type starredModel struct {
	width  int
	height int

	// Input
	username  string
	inputMode bool

	// Data
	repos     []models.GitHubStarred
	languages map[string]int
	total     int64
	selected  int
	offset    int

	// Filters
	language    string
	searchMode  bool
	searchQuery string

	// Loading state
	loading bool
	err     error
}

func newStarredModel() starredModel {
	return starredModel{
		inputMode: true,
	}
}

func (s *starredModel) setSize(w, h int) {
	s.width = w
	s.height = h
}

func (s starredModel) Init() tea.Cmd {
	return nil
}

func (s starredModel) Update(msg tea.Msg) (starredModel, tea.Cmd) {
	switch msg := msg.(type) {
	case starredDataMsg:
		s.loading = false
		if msg.err != nil {
			s.err = msg.err
		} else {
			s.repos = msg.repos
			s.total = msg.total
			s.selected = 0
			s.offset = 0
			s.err = nil
		}
		return s, nil

	case userLanguagesMsg:
		if msg.err == nil {
			s.languages = msg.breakdown
		}
		return s, nil

	case tea.KeyMsg:
		if s.inputMode {
			switch msg.String() {
			case "esc":
				s.inputMode = false
				return s, nil
			case "enter":
				s.inputMode = false
				return s, tea.Batch(s.loadData(), s.loadLanguages())
			case "backspace":
				if len(s.username) > 0 {
					s.username = s.username[:len(s.username)-1]
				}
				return s, nil
			case " ":
				s.username += " "
				return s, nil
			default:
				if len(msg.String()) == 1 {
					s.username += msg.String()
				}
				return s, nil
			}
		}

		if s.searchMode {
			switch msg.String() {
			case "esc":
				s.searchMode = false
				s.searchQuery = ""
				return s, nil
			case "enter":
				s.searchMode = false
				return s, nil
			case "backspace":
				if len(s.searchQuery) > 0 {
					s.searchQuery = s.searchQuery[:len(s.searchQuery)-1]
				}
				return s, nil
			default:
				if len(msg.String()) == 1 {
					s.searchQuery += msg.String()
				}
				return s, nil
			}
		}

		switch msg.String() {
		case "up", "k":
			if s.selected > 0 {
				s.selected--
			}
			if s.selected < s.offset {
				s.offset = s.selected
			}
			return s, nil

		case "down", "j":
			if s.selected < len(s.repos)-1 {
				s.selected++
			}
			visibleRows := s.visibleRows()
			if s.selected >= s.offset+visibleRows {
				s.offset = s.selected - visibleRows + 1
			}
			return s, nil

		case "enter":
			if s.selected < len(s.repos) {
				repo := s.repos[s.selected]
				_ = repo.URL
			}
			return s, nil

		case "u":
			s.inputMode = true
			return s, nil

		case "r":
			return s, s.loadData()

		case "f":
			return s, s.fetchData()

		case "/":
			s.searchMode = true
			s.searchQuery = ""
			return s, nil
		}
	}

	return s, nil
}

func (s starredModel) View() string {
	if s.width < 40 {
		return "Window too small"
	}

	var parts []string

	parts = append(parts, titleStyle.Render("GitHub Starred Repositories"))

	if s.inputMode {
		parts = append(parts, "")
		parts = append(parts, labelStyle.Render("  Enter GitHub username:"))
		parts = append(parts, inputStyle.Width(s.width-6).Render(s.username+"_"))
	} else {
		userInfo := fmt.Sprintf("  User: %s | Language: %s | Total: %d",
			formatUsername(s.username), formatLanguage(s.language), s.total)
		parts = append(parts, subtitleStyle.Render(userInfo))
		parts = append(parts, helpStyle.Render("  Press 'u' to change user | 'f' to fetch | '/' to search"))
	}

	if s.searchMode {
		parts = append(parts, "")
		parts = append(parts, inputStyle.Width(s.width-4).Render("Filter: "+s.searchQuery+"_"))
	}

	parts = append(parts, "")

	if s.loading {
		parts = append(parts, "  Loading...")
	} else if s.err != nil {
		parts = append(parts, errorStyle.Render("  Error: "+s.err.Error()))
	} else if s.inputMode {
		// waiting for username
	} else if len(s.repos) == 0 {
		if s.username != "" {
			parts = append(parts, "  No starred repositories found. Press 'f' to fetch.")
		} else {
			parts = append(parts, "  Enter a username to get started (press 'u').")
		}
	} else if len(s.repos) > 0 {
		tableWidth := s.width * 75 / 100
		sidebarWidth := s.width - tableWidth - 4
		if sidebarWidth < 15 {
			sidebarWidth = 15
			tableWidth = s.width - sidebarWidth - 4
		}

		tableContent := s.renderTable(tableWidth)
		sidebarContent := s.renderSidebar(sidebarWidth)

		parts = append(parts, lipgloss.JoinHorizontal(lipgloss.Top,
			tableContent,
			"  ",
			panelStyle.Width(sidebarWidth).Render(sidebarContent),
		))

		visibleRows := s.visibleRows()
		end := s.offset + visibleRows
		if end > len(s.repos) {
			end = len(s.repos)
		}
		pageInfo := fmt.Sprintf("  Showing %d-%d of %d",
			s.offset+1, end, s.total)
		parts = append(parts, helpStyle.Render(pageInfo))
	}

	return lipgloss.JoinVertical(lipgloss.Left, parts...)
}

func (s starredModel) renderTable(tableWidth int) string {
	var lines []string

	lines = append(lines, s.renderHeader(tableWidth))

	visibleRows := s.visibleRows()
	end := s.offset + visibleRows
	if end > len(s.repos) {
		end = len(s.repos)
	}

	for i := s.offset; i < end; i++ {
		lines = append(lines, s.renderRow(i, tableWidth))
	}

	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

func (s starredModel) renderHeader(tableWidth int) string {
	cols := []string{"REPOSITORY", "LANGUAGE", "STARS", "STARRED AT"}
	widths := s.columnWidths(tableWidth)

	var cells []string
	for i, col := range cols {
		cells = append(cells, tableHeaderStyle.Width(widths[i]).Render(truncateString(col, widths[i])))
	}

	return lipgloss.JoinHorizontal(lipgloss.Left, cells...)
}

func (s starredModel) renderRow(idx, tableWidth int) string {
	repo := s.repos[idx]
	widths := s.columnWidths(tableWidth)

	style := tableRowStyle
	if idx%2 == 1 {
		style = tableRowAltStyle
	}
	if idx == s.selected {
		style = tableRowSelectedStyle
	}

	lang := repo.Language
	if lang == "" {
		lang = "-"
	}

	starredAt := repo.StarredAt.Format("2006-01-02")

	cells := []string{
		style.Width(widths[0]).Render(truncateString(repo.FullName, widths[0])),
		languageStyle.Width(widths[1]).Render(truncateString(lang, widths[1])),
		starStyle.Width(widths[2]).Render(fmt.Sprintf("%d", repo.Stars)),
		forkStyle.Width(widths[3]).Render(starredAt),
	}

	return lipgloss.JoinHorizontal(lipgloss.Left, cells...)
}

func (s starredModel) columnWidths(tableWidth int) []int {
	avail := tableWidth - 4
	if avail < 40 {
		avail = 40
	}
	return []int{
		avail * 45 / 100,
		avail * 20 / 100,
		avail * 17 / 100,
		avail * 18 / 100,
	}
}

func (s starredModel) renderSidebar(width int) string {
	var lines []string

	lines = append(lines, subtitleStyle.Render("Languages"))
	lines = append(lines, "")

	if len(s.languages) == 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(lipgloss.Color(colorSlate500)).Render("  No data"))
	} else {
		type langCount struct {
			lang  string
			count int
		}
		var sorted []langCount
		for lang, count := range s.languages {
			sorted = append(sorted, langCount{lang, count})
		}
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].count > sorted[j].count
		})

		for _, lc := range sorted {
			line := fmt.Sprintf("  %s %d", truncateString(lc.lang, width-8), lc.count)
			lines = append(lines, languageStyle.Render(line))
		}
	}

	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

func (s starredModel) visibleRows() int {
	availHeight := s.height - 12
	if availHeight < 3 {
		availHeight = 3
	}
	return availHeight
}

func (s starredModel) onFocus() tea.Cmd {
	if s.username != "" && !s.inputMode {
		return tea.Batch(s.loadData(), s.loadLanguages())
	}
	return nil
}

func (s starredModel) loadData() tea.Cmd {
	username := s.username
	language := s.language
	limit := s.visibleRows()
	return func() tea.Msg {
		svc := services.NewGitHubService()
		repos, total, err := svc.GetStarred(context.Background(), username, language, limit, 0, "starred_at")
		if err != nil {
			return starredDataMsg{err: err}
		}
		return starredDataMsg{repos: repos, total: total}
	}
}

func (s starredModel) fetchData() tea.Cmd {
	if s.username == "" {
		s.inputMode = true
		return nil
	}
	username := s.username
	return func() tea.Msg {
		svc := services.NewGitHubService()
		repos, err := svc.FetchUserStarred(context.Background(), username, 100)
		if err != nil {
			return starredDataMsg{err: err}
		}
		return starredDataMsg{repos: repos, total: int64(len(repos))}
	}
}

func (s starredModel) loadLanguages() tea.Cmd {
	username := s.username
	return func() tea.Msg {
		svc := services.NewGitHubService()
		breakdown, err := svc.GetUserLanguages(context.Background(), username)
		return userLanguagesMsg{breakdown: breakdown, err: err}
	}
}

func formatUsername(u string) string {
	if u == "" {
		return "(not set)"
	}
	return u
}
