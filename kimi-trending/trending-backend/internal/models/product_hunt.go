package models

import "time"

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
