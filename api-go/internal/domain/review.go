package domain

import "time"

// Review targets and states.
const (
	ReviewTargetProduct = "product"
	ReviewTargetArtisan = "artisan"

	ReviewVisible = "visible"
	ReviewHidden  = "hidden"
)

// Review is one buyer's rating of a product or an artisan. Only buyers who
// really received the goods (payout released) or had the booking completed can
// write one, and each buyer can review each listing once. A moderator can hide
// a review without deleting it.
type Review struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ReviewerID string    `gorm:"type:uuid;not null;uniqueIndex:idx_review_once,priority:1" json:"reviewer_id"`
	TargetType string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_review_once,priority:2;index:idx_review_target,priority:1" json:"target_type"`
	TargetID   string    `gorm:"type:varchar(40);not null;uniqueIndex:idx_review_once,priority:3;index:idx_review_target,priority:2" json:"target_id"`
	ItemName   string    `gorm:"type:varchar(200)" json:"item_name"`
	Rating     int       `gorm:"not null" json:"rating"`
	Body       string    `gorm:"type:text" json:"body"`
	Status     string    `gorm:"type:varchar(10);not null;default:'visible';index" json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
