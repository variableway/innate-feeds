package model

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

// ProductHunt represents a trending product from Product Hunt.
type ProductHunt struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ProductID     string    `gorm:"not null;uniqueIndex:idx_ph_product_date" json:"product_id"`
	Name          string    `gorm:"not null" json:"name"`
	Tagline       string    `json:"tagline"`
	Description   string    `json:"description"`
	URL           string    `json:"url"`
	Thumbnail     string    `json:"thumbnail"`
	VotesCount    int       `json:"votes_count"`
	CommentsCount int       `json:"comments_count"`
	Makers        string    `json:"makers"`
	Topics        string    `json:"topics"`
	Day           time.Time `gorm:"not null;index;uniqueIndex:idx_ph_product_date" json:"day"`
	Featured      bool      `json:"featured"`
	FetchedAt     time.Time `gorm:"not null" json:"fetched_at"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName specifies the database table name.
func (ProductHunt) TableName() string {
	return "product_hunt"
}
