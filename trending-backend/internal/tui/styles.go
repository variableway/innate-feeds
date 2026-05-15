package tui

import (
	"github.com/charmbracelet/lipgloss"
)

// Color palette
const (
	// Primary
	colorIndigo    = "#6366F1"
	colorIndigo600 = "#4F46E5"
	colorIndigo400 = "#818CF8"

	// Secondary
	colorTeal    = "#14B8A6"
	colorTeal400 = "#2DD4BF"

	// Accent
	colorAmber   = "#F59E0B" // for stars
	colorRose    = "#F43F5E" // for errors
	colorEmerald = "#10B981" // for success
	colorSky     = "#38BDF8" // for info

	// Neutrals
	colorSlate900 = "#0F172A"
	colorSlate800 = "#1E293B"
	colorSlate700 = "#334155"
	colorSlate600 = "#475569"
	colorSlate500 = "#64748B"
	colorSlate400 = "#94A3B8"
	colorSlate300 = "#CBD5E1"
	colorSlate200 = "#E2E8F0"
	colorSlate100 = "#F1F5F9"
	colorSlate50  = "#F8FAFC"

	// Border
	colorBorder = "#334155"
)

var (
	// App styles
	appStyle = lipgloss.NewStyle()

	// Title styles
	titleStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorIndigo400)).
		MarginLeft(1).
		MarginRight(1)

	subtitleStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate400)).
		MarginLeft(1)

	// Tab styles
	tabActiveStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorSlate50)).
		Background(lipgloss.Color(colorIndigo)).
		Padding(0, 2).
		MarginRight(1).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(colorIndigo))

	tabInactiveStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate400)).
		Padding(0, 2).
		MarginRight(1).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(colorBorder))

	tabBarStyle = lipgloss.NewStyle().
		Background(lipgloss.Color(colorSlate800)).
		Padding(0, 1)

	// Table styles
	tableHeaderStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorSlate100)).
		Background(lipgloss.Color(colorSlate700)).
		Padding(0, 1)

	tableRowStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate300)).
		Padding(0, 1)

	tableRowAltStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate400)).
		Background(lipgloss.Color(colorSlate800)).
		Padding(0, 1)

	tableRowSelectedStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate50)).
		Background(lipgloss.Color(colorIndigo600)).
		Bold(true).
		Padding(0, 1)

	tableCellStyle = lipgloss.NewStyle().
		Padding(0, 1)

	// Star/fork count styles
	starStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorAmber))

	forkStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate400))

	languageStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorTeal400))

	voteStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorRose))

	commentStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSky))

	featuredStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorAmber)).
		Bold(true)

	// Help text
	helpStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate500)).
		Padding(0, 1)

	helpKeyStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(colorIndigo400))

	// Error style
	errorStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorRose)).
		Bold(true)

	// Success style
	successStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorEmerald)).
		Bold(true)

	// Info/label style
	labelStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate400)).
		Bold(true)

	valueStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate200))

	// Panel/box style
	panelStyle = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(colorBorder)).
		Padding(1, 2)

	panelActiveStyle = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(colorIndigo)).
		Padding(1, 2)

	// Search/filter input style
	inputStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate200)).
		Background(lipgloss.Color(colorSlate700)).
		Padding(0, 1).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(colorIndigo))

	// Status bar style
	statusBarStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorSlate400)).
		Background(lipgloss.Color(colorSlate900)).
		Padding(0, 1)

	// Sparkline/bar chart style
	barStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorIndigo))

	barStyleAlt = lipgloss.NewStyle().
		Foreground(lipgloss.Color(colorIndigo400))
)
