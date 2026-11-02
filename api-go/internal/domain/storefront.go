package domain

import (
	"context"
	"time"
)

// Storefront represents a merchant or artisan branded digital storefront.
type Storefront struct {
	ID             uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerID        string    `gorm:"type:uuid;not null;uniqueIndex" json:"owner_id"`
	OwnerType      string    `gorm:"type:varchar(10);not null" json:"owner_type"` // "seller" | "artisan"
	Handle         string    `gorm:"type:varchar(50);not null;uniqueIndex" json:"handle"`
	CustomDomain   *string   `gorm:"type:varchar(253);uniqueIndex" json:"custom_domain,omitempty"`
	DomainVerified bool      `gorm:"type:boolean;default:false" json:"domain_verified"`
	TemplateID     string    `gorm:"type:varchar(20);not null;default:'editorial'" json:"template_id"` // editorial|split|minimal|hero|studio
	LogoURL        *string   `gorm:"type:varchar(500)" json:"logo_url,omitempty"`
	BannerURL      *string   `gorm:"type:varchar(500)" json:"banner_url,omitempty"`
	AccentHex      string    `gorm:"type:varchar(7);not null;default:'#C5A880'" json:"accent_hex"`
	OnAccentHex    string    `gorm:"type:varchar(7);not null;default:'#000000'" json:"on_accent_hex"`
	SoftHex        string    `gorm:"type:varchar(7);not null;default:'#DFCDAF'" json:"soft_hex"`
	DeepHex        string    `gorm:"type:varchar(7);not null;default:'#8F724D'" json:"deep_hex"`
	ThemeVariant   string    `gorm:"type:varchar(10);not null;default:'true'" json:"theme_variant"` // true|soft|deep|muted|vivid
	Bio            string    `gorm:"type:varchar(280)" json:"bio"`
	Live           bool      `gorm:"type:boolean;default:false" json:"live"`
	TotalViews     int64     `gorm:"type:bigint;default:0" json:"total_views"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// StorefrontHandleHistory tracks historical handles for redirection and quarantine.
type StorefrontHandleHistory struct {
	ID                uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerID           string    `gorm:"type:uuid;index;not null" json:"owner_id"`
	OldHandle         string    `gorm:"type:varchar(50);index;not null" json:"old_handle"`
	NewHandle         string    `gorm:"type:varchar(50);not null" json:"new_handle"`
	ChangedAt         time.Time `gorm:"not null" json:"changed_at"`
	RedirectExpiresAt time.Time `gorm:"not null" json:"redirect_expires_at"` // 180 days after changed_at
	QuarantineEndsAt  time.Time `gorm:"not null" json:"quarantine_ends_at"`  // 210 days after changed_at
}

// ReservedHandle protects system routes and registered brand trademarks.
type ReservedHandle struct {
	Handle           string    `gorm:"type:varchar(50);primaryKey" json:"handle"`
	Reason           string    `gorm:"type:varchar(100);not null" json:"reason"` // "system" | "brand" | "squatter-protection"
	ClaimableByEmail *string   `gorm:"type:varchar(255)" json:"claimable_by_email,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// StorefrontRepository defines data layer access for storefronts.
type StorefrontRepository interface {
	GetByOwnerID(ctx context.Context, ownerID string) (*Storefront, error)
	GetByHandle(ctx context.Context, handle string) (*Storefront, error)
	Save(ctx context.Context, sf *Storefront) error
	IsHandleAvailable(ctx context.Context, handle string, callerOwnerID string, callerEmail string) (bool, string, error)
	RecordHandleChange(ctx context.Context, ownerID string, oldHandle string, newHandle string) error
	GetHistoricalHandleRedirect(ctx context.Context, handle string) (*StorefrontHandleHistory, error)
	IncrementViews(ctx context.Context, storefrontID uint) error
	SeedReservedHandles(ctx context.Context, handles []ReservedHandle) error
}
