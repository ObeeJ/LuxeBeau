package domain

import (
	"context"
	"time"
)

// Standard Ad Plan Pricing in Kobo (1 NGN = 100 Kobo)
const (
	AdPrice7DaysKobo  int64 = 500000   // ₦5,000 for 7 days (~₦714/day)
	AdPrice30DaysKobo int64 = 1500000  // ₦15,000 for 30 days (~₦500/day, saves 25% vs 4 weekly runs)
	AdPriceAnnualKobo int64 = 12000000 // ₦120,000 for 365 days (~₦10,000/mo, 4 months free, saves ₦60,000 vs monthly)
)

type PromotionPlan string

const (
	Plan7Days  PromotionPlan = "7_days"
	Plan30Days PromotionPlan = "30_days"
	PlanAnnual PromotionPlan = "annual"
)

type PromotionType string

const (
	PromotionTypeProduct    PromotionType = "product"
	PromotionTypeStorefront PromotionType = "storefront"
	PromotionTypeArtisan    PromotionType = "artisan"
)

type PromotionStatus string

const (
	PromotionStatusActive  PromotionStatus = "active"
	PromotionStatusPending PromotionStatus = "pending"
	PromotionStatusExpired PromotionStatus = "expired"
	PromotionStatusPaused  PromotionStatus = "paused"
)

// FeaturedAd represents a paid ad or featured post shown right beneath the hero.
type FeaturedAd struct {
	ID               string          `gorm:"type:uuid;primaryKey" json:"id"`
	MerchantID       string          `gorm:"type:uuid;index;not null" json:"merchant_id"`
	Type             PromotionType   `gorm:"type:varchar(30);not null" json:"type"` // "product", "storefront", "artisan"
	TargetID         string          `gorm:"type:varchar(100);not null" json:"target_id"` // product slug/id, artisan id, or storefront handle
	Title            string          `gorm:"type:varchar(150);not null" json:"title"`
	Tagline          string          `gorm:"type:varchar(255)" json:"tagline"`
	Description      string          `gorm:"type:text" json:"description"`
	Badge            string          `gorm:"type:varchar(50);default:'Featured Partner'" json:"badge"`
	ImageURL         string          `gorm:"type:text;not null" json:"image_url"`
	LinkURL          string          `gorm:"type:varchar(255);not null" json:"link_url"`
	Plan             PromotionPlan   `gorm:"type:varchar(20);not null" json:"plan"`
	AmountKobo       int64           `gorm:"type:bigint;not null" json:"amount_kobo"`
	StartsAt         time.Time       `gorm:"index;not null" json:"starts_at"`
	ExpiresAt        time.Time       `gorm:"index;not null" json:"expires_at"`
	Status           PromotionStatus `gorm:"type:varchar(20);default:'active';index" json:"status"`
	ClicksCount      int64           `gorm:"default:0" json:"clicks_count"`
	ImpressionsCount int64           `gorm:"default:0" json:"impressions_count"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

type PromotionRepository interface {
	Create(ctx context.Context, ad *FeaturedAd) error
	GetByID(ctx context.Context, id string) (*FeaturedAd, error)
	ListActive(ctx context.Context, limit int) ([]FeaturedAd, error)
	ListByMerchant(ctx context.Context, merchantID string) ([]FeaturedAd, error)
	ListAll(ctx context.Context, limit, offset int) ([]FeaturedAd, int64, error)
	UpdateStatus(ctx context.Context, id string, status PromotionStatus) error
	IncrementImpression(ctx context.Context, id string) error
	IncrementClick(ctx context.Context, id string) error
}
