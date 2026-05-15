package tui

import (
	"context"

	"trending-backend/internal/models"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Tab indices
const (
	tabDashboard = iota
	tabTrending
	tabStarred
	tabProduct
	tabHelp
)

var tabNames = []string{
	"Dashboard",
	"GitHub Trending",
	"GitHub Starred",
	"Product Hunt",
	"Help",
}

// Msg types for async operations
type (
	// dashboard msgs
	statsMsg struct {
		ghTrendingCount int64
		ghStarredCount  int64
		productCount    int64
		err             error
	}

	// trending msgs
	trendingDataMsg struct {
		repos []models.GitHubTrending
		total int64
		err   error
	}

	languagesMsg struct {
		languages []string
		err       error
	}

	// starred msgs
	starredDataMsg struct {
		repos []models.GitHubStarred
		total int64
		err   error
	}

	userLanguagesMsg struct {
		breakdown map[string]int
		err       error
	}

	// product msgs
	productDataMsg struct {
		products []models.ProductHunt
		total    int64
		err      error
	}
)

// model is the main Bubble Tea model for the TUI.
type model struct {
	tabs      []string
	activeTab int

	// Dimensions
	width  int
	height int

	// Global state
	ctx    context.Context
	cancel context.CancelFunc

	// Sub-models for each tab
	trendingModel  trendingModel
	starredModel   starredModel
	productModel   productModel
	dashboardModel dashboardModel
}

// Ensure model implements tea.Model
var _ tea.Model = (*model)(nil)

// NewModel creates a new TUI model.
func NewModel() model {
	ctx, cancel := context.WithCancel(context.Background())

	return model{
		tabs:      tabNames,
		activeTab: tabDashboard,
		ctx:       ctx,
		cancel:    cancel,
		dashboardModel: newDashboardModel(),
		trendingModel:  newTrendingModel(),
		starredModel:   newStarredModel(),
		productModel:   newProductModel(),
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		m.dashboardModel.Init(),
		m.trendingModel.Init(),
		m.starredModel.Init(),
		m.productModel.Init(),
	)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		// Propagate to sub-models
		m.dashboardModel.setSize(msg.Width, msg.Height)
		m.trendingModel.setSize(msg.Width, msg.Height)
		m.starredModel.setSize(msg.Width, msg.Height)
		m.productModel.setSize(msg.Width, msg.Height)

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			m.cancel()
			return m, tea.Quit

		case "tab":
			m.activeTab = (m.activeTab + 1) % len(m.tabs)
			cmds = append(cmds, m.onTabChanged())
			return m, tea.Batch(cmds...)

		case "shift+tab":
			m.activeTab--
			if m.activeTab < 0 {
				m.activeTab = len(m.tabs) - 1
			}
			cmds = append(cmds, m.onTabChanged())
			return m, tea.Batch(cmds...)
		}
	}

	// Route messages to sub-models based on active tab
	switch m.activeTab {
	case tabDashboard:
		dm, cmd := m.dashboardModel.Update(msg)
		m.dashboardModel = dm
		cmds = append(cmds, cmd)

	case tabTrending:
		tm, cmd := m.trendingModel.Update(msg)
		m.trendingModel = tm
		cmds = append(cmds, cmd)

	case tabStarred:
		sm, cmd := m.starredModel.Update(msg)
		m.starredModel = sm
		cmds = append(cmds, cmd)

	case tabProduct:
		pm, cmd := m.productModel.Update(msg)
		m.productModel = pm
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m model) View() string {
	if m.width == 0 || m.height == 0 {
		return "Loading..."
	}

	tabBar := m.renderTabBar()

	var content string
	switch m.activeTab {
	case tabDashboard:
		content = m.dashboardModel.View()
	case tabTrending:
		content = m.trendingModel.View()
	case tabStarred:
		content = m.starredModel.View()
	case tabProduct:
		content = m.productModel.View()
	case tabHelp:
		content = renderHelp()
	}

	statusBar := m.renderStatusBar()

	return lipgloss.JoinVertical(lipgloss.Left,
		"",
		tabBar,
		"",
		content,
		statusBar,
	)
}

func (m model) renderTabBar() string {
	var tabs []string
	for i, name := range m.tabs {
		if i == m.activeTab {
			tabs = append(tabs, tabActiveStyle.Render(name))
		} else {
			tabs = append(tabs, tabInactiveStyle.Render(name))
		}
	}
	return tabBarStyle.Render(lipgloss.JoinHorizontal(lipgloss.Top, tabs...))
}

func (m model) renderStatusBar() string {
	msg := " Ready"
	shortcutHelp := " tab:next | shift+tab:prev | r:refresh | f:fetch | /:search | q:quit "

	left := statusBarStyle.Width(m.width/2).Render(msg)
	right := statusBarStyle.Width(m.width/2).Align(lipgloss.Right).Render(shortcutHelp)

	return lipgloss.JoinHorizontal(lipgloss.Top, left, right)
}

func (m model) onTabChanged() tea.Cmd {
	switch m.activeTab {
	case tabDashboard:
		return m.dashboardModel.onFocus()
	case tabTrending:
		return m.trendingModel.onFocus()
	case tabStarred:
		return m.starredModel.onFocus()
	case tabProduct:
		return m.productModel.onFocus()
	}
	return nil
}
