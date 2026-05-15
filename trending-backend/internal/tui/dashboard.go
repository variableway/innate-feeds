package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"trending-backend/internal/db"
)

// dashboardModel represents the Dashboard tab.
type dashboardModel struct {
	width  int
	height int

	ghTrendingCount int64
	ghStarredCount  int64
	productCount    int64

	activityLog []string

	err error
}

func newDashboardModel() dashboardModel {
	return dashboardModel{
		activityLog: []string{
			time.Now().Format("15:04:05") + "  Dashboard initialized",
		},
	}
}

func (d *dashboardModel) setSize(w, h int) {
	d.width = w
	d.height = h
}

func (d dashboardModel) Init() tea.Cmd {
	return fetchStatsCmd
}

func (d dashboardModel) Update(msg tea.Msg) (dashboardModel, tea.Cmd) {
	switch msg := msg.(type) {
	case statsMsg:
		if msg.err != nil {
			d.err = msg.err
		} else {
			d.ghTrendingCount = msg.ghTrendingCount
			d.ghStarredCount = msg.ghStarredCount
			d.productCount = msg.productCount
			d.err = nil
			d.logActivity(fmt.Sprintf("Stats updated: %d trending, %d starred, %d products",
				msg.ghTrendingCount, msg.ghStarredCount, msg.productCount))
		}
		return d, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "r":
			return d, fetchStatsCmd
		}
	}

	return d, nil
}

func (d dashboardModel) View() string {
	if d.width < 40 || d.height < 10 {
		return "Window too small"
	}

	title := titleStyle.Render("Trending Aggregator Dashboard")

	cardWidth := (d.width - 8) / 3
	if cardWidth < 20 {
		cardWidth = 20
	}

	trendingCard := d.renderStatCard("GitHub Trending", fmt.Sprintf("%d", d.ghTrendingCount), "repositories", cardWidth)
	starredCard := d.renderStatCard("GitHub Starred", fmt.Sprintf("%d", d.ghStarredCount), "starred repos", cardWidth)
	productCard := d.renderStatCard("Product Hunt", fmt.Sprintf("%d", d.productCount), "products", cardWidth)

	cardsRow := lipgloss.JoinHorizontal(lipgloss.Top, trendingCard, "  ", starredCard, "  ", productCard)

	barChart := d.renderBarChart()

	activityPanel := d.renderActivityLog()

	content := lipgloss.JoinVertical(lipgloss.Left,
		title,
		"",
		cardsRow,
		"",
		barChart,
		"",
		activityPanel,
	)

	return panelStyle.Width(d.width - 2).Render(content)
}

func (d dashboardModel) renderStatCard(title, value, subtitle string, width int) string {
	titleStr := subtitleStyle.Width(width).Render(title)
	valueStr := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorIndigo400)).
		Width(width).
		Render(value)
	subStr := lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate500)).
		Width(width).
		Render(subtitle)

	content := lipgloss.JoinVertical(lipgloss.Left, titleStr, valueStr, subStr)

	return panelStyle.
		Width(width).
		Height(6).
		Render(content)
}

func (d dashboardModel) renderBarChart() string {
	if d.width < 40 {
		return ""
	}

	maxVal := d.ghTrendingCount
	if d.ghStarredCount > maxVal {
		maxVal = d.ghStarredCount
	}
	if d.productCount > maxVal {
		maxVal = d.productCount
	}
	if maxVal == 0 {
		maxVal = 1
	}

	chartWidth := d.width - 20
	if chartWidth < 10 {
		chartWidth = 10
	}

	bar1Len := int(float64(chartWidth) * float64(d.ghTrendingCount) / float64(maxVal))
	bar2Len := int(float64(chartWidth) * float64(d.ghStarredCount) / float64(maxVal))
	bar3Len := int(float64(chartWidth) * float64(d.productCount) / float64(maxVal))

	if d.ghTrendingCount > 0 && bar1Len == 0 {
		bar1Len = 1
	}
	if d.ghStarredCount > 0 && bar2Len == 0 {
		bar2Len = 1
	}
	if d.productCount > 0 && bar3Len == 0 {
		bar3Len = 1
	}

	bar1 := barStyle.Render(strings.Repeat("█", bar1Len))
	bar2 := barStyleAlt.Render(strings.Repeat("█", bar2Len))
	bar3 := lipgloss.NewStyle().Foreground(lipgloss.Color(colorTeal)).Render(strings.Repeat("█", bar3Len))

	label1 := labelStyle.Width(18).Render("GH Trending:")
	label2 := labelStyle.Width(18).Render("GH Starred:")
	label3 := labelStyle.Width(18).Render("Product Hunt:")

	chart := lipgloss.JoinVertical(lipgloss.Left,
		subtitleStyle.Render("Data Distribution"),
		"",
		label1+bar1+fmt.Sprintf(" %d", d.ghTrendingCount),
		"",
		label2+bar2+fmt.Sprintf(" %d", d.ghStarredCount),
		"",
		label3+bar3+fmt.Sprintf(" %d", d.productCount),
	)

	return panelStyle.Width(d.width - 2).Render(chart)
}

func (d dashboardModel) renderActivityLog() string {
	maxLines := d.height / 3
	if maxLines < 3 {
		maxLines = 3
	}
	if maxLines > 10 {
		maxLines = 10
	}

	logs := d.activityLog
	if len(logs) > maxLines {
		logs = logs[len(logs)-maxLines:]
	}

	var lines []string
	lines = append(lines, subtitleStyle.Render("Recent Activity"))
	lines = append(lines, "")

	for _, log := range logs {
		lines = append(lines, lipgloss.NewStyle().Foreground(lipgloss.Color(colorSlate400)).Render("  "+log))
	}

	return panelStyle.Width(d.width - 2).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (d dashboardModel) onFocus() tea.Cmd {
	return fetchStatsCmd
}

func (d *dashboardModel) logActivity(msg string) {
	timestamp := time.Now().Format("15:04:05")
	d.activityLog = append(d.activityLog, timestamp+"  "+msg)
}

func fetchStatsCmd() tea.Msg {
	var ghTrendingCount, ghStarredCount, productCount int64

	database := db.Get()
	database.Table("github_trending").Count(&ghTrendingCount)
	database.Table("github_starred").Count(&ghStarredCount)
	database.Table("product_hunt").Count(&productCount)

	return statsMsg{
		ghTrendingCount: ghTrendingCount,
		ghStarredCount:  ghStarredCount,
		productCount:    productCount,
	}
}
