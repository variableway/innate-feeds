package models

import "time"

// GitHubStarred represents a repository starred by a GitHub user.
type GitHubStarred struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	RepoName    string    `gorm:"not null" json:"repo_name"`
	Owner       string    `gorm:"not null" json:"owner"`
	FullName    string    `gorm:"not null;uniqueIndex:idx_gh_starred_fullname_user" json:"full_name"`
	Username    string    `gorm:"not null;index;uniqueIndex:idx_gh_starred_fullname_user" json:"username"`
	Description string    `json:"description"`
	Language    string    `gorm:"index" json:"language"`
	Stars       int       `json:"stars"`
	Forks       int       `json:"forks"`
	StarredAt   time.Time `json:"starred_at"`
	Topics      string    `json:"topics"`
	URL         string    `json:"url"`
	Private     bool      `json:"private"`
	FetchedAt   time.Time `gorm:"not null" json:"fetched_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TableName specifies the database table name.
func (GitHubStarred) TableName() string {
	return "github_starred"
}
