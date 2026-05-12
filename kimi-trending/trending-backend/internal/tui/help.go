package tui

import (
	"github.com/charmbracelet/lipgloss"
)

// renderHelp returns the help tab content.
func renderHelp() string {
	content := lipgloss.JoinVertical(lipgloss.Left,
		"",
		titleStyle.Render("Keyboard Shortcuts & Help"),
		"",
		"",
		renderSection("Global Keys", []keyBinding{
			{key: "Tab", desc: "Switch to next tab"},
			{key: "Shift+Tab", desc: "Switch to previous tab"},
			{key: "q / Ctrl+C", desc: "Quit the application"},
			{key: "r", desc: "Refresh data for current tab"},
			{key: "f", desc: "Fetch new data from external APIs"},
			{key: "/", desc: "Focus search/filter input"},
		}),
		"",
		renderSection("Navigation", []keyBinding{
			{key: "↑ / k", desc: "Move selection up"},
			{key: "↓ / j", desc: "Move selection down"},
			{key: "Enter", desc: "Open selected item URL"},
		}),
		"",
		renderSection("Dashboard Tab", []keyBinding{
			{key: "r", desc: "Refresh statistics"},
		}),
		"",
		renderSection("GitHub Trending Tab", []keyBinding{
			{key: "1", desc: "Filter: daily period"},
			{key: "2", desc: "Filter: weekly period"},
			{key: "3", desc: "Filter: monthly period"},
			{key: "l", desc: "Cycle through languages"},
			{key: "f", desc: "Fetch trending repos from GitHub"},
			{key: "/", desc: "Search repositories"},
		}),
		"",
		renderSection("GitHub Starred Tab", []keyBinding{
			{key: "u", desc: "Enter username"},
			{key: "f", desc: "Fetch starred repos for user"},
			{key: "l", desc: "Filter by language"},
			{key: "/", desc: "Search repositories"},
		}),
		"",
		renderSection("Product Hunt Tab", []keyBinding{
			{key: "d", desc: "Go to previous day"},
			{key: "D", desc: "Go to next day"},
			{key: "f", desc: "Fetch products from Product Hunt"},
			{key: "/", desc: "Search products"},
		}),
		"",
		renderSection("Search Mode", []keyBinding{
			{key: "Esc", desc: "Cancel search"},
			{key: "Enter", desc: "Confirm search"},
			{key: "Backspace", desc: "Delete last character"},
		}),
	)

	return panelStyle.Render(content)
}

type keyBinding struct {
	key  string
	desc string
}

func renderSection(title string, bindings []keyBinding) string {
	var lines []string

	lines = append(lines, lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorIndigo400)).
		Render(title))
	lines = append(lines, lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate700)).
		Render("─────────────────────────────────────"))

	for _, kb := range bindings {
		keyStr := helpKeyStyle.Width(16).Align(lipgloss.Right).Render(kb.key)
		descStr := lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorSlate300)).
			Render("  " + kb.desc)
		lines = append(lines, lipgloss.JoinHorizontal(lipgloss.Left, keyStr, descStr))
	}

	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}
