package models

import "time"

// GitHubTrending represents a trending repository on GitHub for a specific period.
type GitHubTrending struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	RepoName     string    `gorm:"not null" json:"repo_name"`
	Owner        string    `gorm:"not null" json:"owner"`
	FullName     string    `gorm:"not null;uniqueIndex:idx_gh_trending_fullname_date" json:"full_name"`
	Description  string    `json:"description"`
	Language     string    `gorm:"index" json:"language"`
	Stars        int       `json:"stars"`
	StarsToday   int       `json:"stars_today"`
	Forks        int       `json:"forks"`
	Period       string    `gorm:"not null;index;uniqueIndex:idx_gh_trending_fullname_date" json:"period"`
	FetchedAt    time.Time `gorm:"not null;index;uniqueIndex:idx_gh_trending_fullname_date" json:"fetched_at"`
	URL          string    `json:"url"`
	Contributors int       `json:"contributors"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TableName specifies the database table name.
func (GitHubTrending) TableName() string {
	return "github_trending"
}
