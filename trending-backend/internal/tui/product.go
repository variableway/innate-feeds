package tui

import (
	"context"
	"fmt"
	"strings"
	"time"

	"trending-backend/internal/models"
	"trending-backend/internal/services"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// productModel represents the Product Hunt tab.
type productModel struct {
	width  int
	height int

	// Data
	products []models.ProductHunt
	total    int64
	selected int
	offset   int

	// Filters
	day         string
	searchMode  bool
	searchQuery string

	// Loading state
	loading bool
	err     error
}

func newProductModel() productModel {
	return productModel{
		day: time.Now().Format("2006-01-02"),
	}
}

func (p *productModel) setSize(w, h int) {
	p.width = w
	p.height = h
}

func (p productModel) Init() tea.Cmd {
	return p.loadData()
}

func (p productModel) Update(msg tea.Msg) (productModel, tea.Cmd) {
	switch msg := msg.(type) {
	case productDataMsg:
		p.loading = false
		if msg.err != nil {
			p.err = msg.err
		} else {
			p.products = msg.products
			p.total = msg.total
			p.selected = 0
			p.offset = 0
			p.err = nil
		}
		return p, nil

	case tea.KeyMsg:
		if p.searchMode {
			switch msg.String() {
			case "esc":
				p.searchMode = false
				p.searchQuery = ""
				return p, nil
			case "enter":
				p.searchMode = false
				return p, nil
			case "backspace":
				if len(p.searchQuery) > 0 {
					p.searchQuery = p.searchQuery[:len(p.searchQuery)-1]
				}
				return p, nil
			case " ":
				p.searchQuery += " "
				return p, nil
			default:
				if len(msg.String()) == 1 {
					p.searchQuery += msg.String()
				}
				return p, nil
			}
		}

		switch msg.String() {
		case "up", "k":
			if p.selected > 0 {
				p.selected--
			}
			if p.selected < p.offset {
				p.offset = p.selected
			}
			return p, nil

		case "down", "j":
			if p.selected < len(p.products)-1 {
				p.selected++
			}
			visibleRows := p.visibleRows()
			if p.selected >= p.offset+visibleRows {
				p.offset = p.selected - visibleRows + 1
			}
			return p, nil

		case "enter":
			if p.selected < len(p.products) {
				prod := p.products[p.selected]
				_ = prod.URL
			}
			return p, nil

		case "d":
			currentDay, _ := time.Parse("2006-01-02", p.day)
			p.day = currentDay.Add(-24 * time.Hour).Format("2006-01-02")
			return p, p.loadData()

		case "D":
			currentDay, _ := time.Parse("2006-01-02", p.day)
			p.day = currentDay.Add(24 * time.Hour).Format("2006-01-02")
			if p.day > time.Now().Format("2006-01-02") {
				p.day = time.Now().Format("2006-01-02")
			}
			return p, p.loadData()

		case "r":
			return p, p.loadData()

		case "f":
			return p, p.fetchData()

		case "/":
			p.searchMode = true
			p.searchQuery = ""
			return p, nil
		}
	}

	return p, nil
}

func (p productModel) View() string {
	if p.width < 40 {
		return "Window too small"
	}

	var parts []string

	parts = append(parts, titleStyle.Render("Product Hunt Trending"))

	dayInfo := fmt.Sprintf("  Day: %s | Total: %d | 'd'/D' change day | 'f' fetch",
		p.day, p.total)
	parts = append(parts, subtitleStyle.Render(dayInfo))

	if p.searchMode {
		parts = append(parts, "")
		parts = append(parts, inputStyle.Width(p.width-4).Render("Search: "+p.searchQuery+"_"))
	}

	parts = append(parts, "")

	parts = append(parts, p.renderHeader())

	if p.loading {
		parts = append(parts, "  Loading...")
	} else if p.err != nil {
		parts = append(parts, errorStyle.Render("  Error: "+p.err.Error()))
	} else if len(p.products) == 0 {
		parts = append(parts, "  No products found. Press 'f' to fetch data.")
	} else {
		visibleRows := p.visibleRows()
		end := p.offset + visibleRows
		if end > len(p.products) {
			end = len(p.products)
		}

		for i := p.offset; i < end; i++ {
			parts = append(parts, p.renderRow(i))
		}

		parts = append(parts, "")
		pageInfo := fmt.Sprintf("  Showing %d-%d of %d (j/k or arrows to navigate)",
			p.offset+1, end, p.total)
		parts = append(parts, helpStyle.Render(pageInfo))
	}

	return lipgloss.JoinVertical(lipgloss.Left, parts...)
}

func (p productModel) renderHeader() string {
	cols := []string{"NAME", "VOTES", "COMMENTS", "FEATURED", "TOPICS"}
	widths := p.columnWidths()

	var cells []string
	for i, col := range cols {
		w := widths[i]
		if w > 0 {
			cells = append(cells, tableHeaderStyle.Width(w).Render(truncateString(col, w)))
		}
	}

	return lipgloss.JoinHorizontal(lipgloss.Left, cells...)
}

func (p productModel) renderRow(idx int) string {
	prod := p.products[idx]
	widths := p.columnWidths()

	style := tableRowStyle
	if idx%2 == 1 {
		style = tableRowAltStyle
	}
	if idx == p.selected {
		style = tableRowSelectedStyle
	}

	topics := "-"
	if prod.Topics != "" && prod.Topics != "null" && prod.Topics != "[]" {
		topics = extractTopicNamesQuick(prod.Topics)
		if len(topics) > widths[4]-2 {
			topics = topics[:widths[4]-5] + "..."
		}
	}

	featured := ""
	if prod.Featured {
		featured = featuredStyle.Render("★")
	}

	name := prod.Name
	if prod.Tagline != "" && len(name)+len(prod.Tagline) < widths[0]-4 {
		name = name + " - " + prod.Tagline
	}

	cells := []string{
		style.Width(widths[0]).Render(truncateString(name, widths[0])),
		voteStyle.Width(widths[1]).Render(fmt.Sprintf("%d", prod.VotesCount)),
		commentStyle.Width(widths[2]).Render(fmt.Sprintf("%d", prod.CommentsCount)),
		style.Width(widths[3]).Render(featured),
		style.Width(widths[4]).Render(topics),
	}

	return lipgloss.JoinHorizontal(lipgloss.Left, cells...)
}

func (p productModel) columnWidths() []int {
	availWidth := p.width - 6
	if availWidth < 60 {
		availWidth = 60
	}

	return []int{
		availWidth * 35 / 100,
		availWidth * 12 / 100,
		availWidth * 14 / 100,
		availWidth * 12 / 100,
		availWidth * 27 / 100,
	}
}

func (p productModel) visibleRows() int {
	availHeight := p.height - 10
	if availHeight < 3 {
		availHeight = 3
	}
	return availHeight
}

func (p productModel) onFocus() tea.Cmd {
	return p.loadData()
}

func (p productModel) loadData() tea.Cmd {
	day := p.day
	limit := p.visibleRows()
	return func() tea.Msg {
		svc := services.NewProductHuntService()
		products, total, err := svc.GetTrending(context.Background(), day, limit, 0)
		if err != nil {
			return productDataMsg{err: err}
		}
		return productDataMsg{products: products, total: total}
	}
}

func (p productModel) fetchData() tea.Cmd {
	day := p.day
	return func() tea.Msg {
		svc := services.NewProductHuntService()
		products, err := svc.FetchTrending(context.Background(), day, 100)
		if err != nil {
			return productDataMsg{err: err}
		}
		return productDataMsg{products: products, total: int64(len(products))}
	}
}

func extractTopicNamesQuick(topicsJSON string) string {
	var names []string
	parts := strings.Split(topicsJSON, `"name":`)
	for i, part := range parts {
		if i == 0 {
			continue
		}
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, `"`) {
			end := strings.Index(part[1:], `"`)
			if end >= 0 {
				names = append(names, part[1:end+1])
			}
		}
	}
	if len(names) > 0 {
		return strings.Join(names, ", ")
	}
	return "-"
}
