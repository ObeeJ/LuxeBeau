package domain

import (
	"context"
	"time"
)

type User struct {
	ID    string `gorm:"type:uuid;primaryKey" json:"id"`
	Name  string `gorm:"type:varchar(100);not null" json:"name"`
	Email string `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	// Empty for accounts that only ever signed in with Google.
	PasswordHash  string     `gorm:"type:varchar(255);not null;default:''" json:"-"`
	EmailVerified bool       `gorm:"type:boolean;default:false" json:"email_verified"`
	GoogleSub     *string    `gorm:"type:varchar(64);uniqueIndex" json:"-"` // Google account subject, set on first Google sign-in
	FailedLogins  int        `gorm:"type:integer;default:0" json:"-"`
	LockedUntil   *time.Time `json:"-"`
	Phone         string     `gorm:"type:varchar(20)" json:"phone"`
	Role          string     `gorm:"type:varchar(20);default:'buyer'" json:"role"`
	Status        string     `gorm:"type:varchar(20);default:'active'" json:"status"`         // active, suspended
	Jurisdiction  string     `gorm:"type:varchar(80)" json:"jurisdiction"`                    // Nigerian state the user operates in
	Verified      bool       `gorm:"type:boolean;default:false" json:"verified"`              // quality-checked / verified badge
	CACNumber     string     `gorm:"type:varchar(30)" json:"cac_number"`                      // CAC registration number (optional — not all partners have one)
	NINNumber     string     `gorm:"type:varchar(20)" json:"-"`                               // NIN — stored for KYC, never returned in API responses
	KYCStatus     string     `gorm:"type:varchar(20);default:'unverified'" json:"kyc_status"` // unverified, pending, verified, failed
	// StorefrontSlug is the partner's unique brand handle, e.g. "arike-spa".
	// Combined with the platform domain it forms arike-spa.luxebeau.com.
	// NULL means not yet claimed; empty string is never stored.
	StorefrontSlug *string `gorm:"type:varchar(80);uniqueIndex" json:"storefront_slug,omitempty"`
	// FeeBps is the platform fee charged on escrow releases for this partner,
	// in basis points. 0 means use the platform default (250 = 2.5%).
	FeeBps int `gorm:"type:integer;default:0" json:"fee_bps,omitempty"`
	// ReleaseWindowHours is how long after delivery confirmation the buyer has
	// to dispute before funds auto-release. 0 means use the platform default.
	ReleaseWindowHours int       `gorm:"type:integer;default:0" json:"release_window_hours,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// EffectiveFeeBps returns the fee to charge on this partner's escrow releases.
// Falls back to the platform default of 2.5% if the partner has no override.
func (u *User) EffectiveFeeBps() int {
	if u.FeeBps > 0 {
		return u.FeeBps
	}
	return PlatformFeeBps
}

// EffectiveReleaseWindowHours returns the buyer's dispute window for this
// partner's orders. Falls back to the platform default of 48 hours.
func (u *User) EffectiveReleaseWindowHours() int {
	if u.ReleaseWindowHours > 0 {
		return u.ReleaseWindowHours
	}
	return PlatformReleaseWindowHours
}

// Platform-wide defaults. These are the only place these values live;
// nothing else in the codebase hardcodes them.
const (
	// PlatformFeeBps is 2.5% — cheaper than Paystack (1.5% + ₦100) and
	// includes escrow protection on top of payment processing.
	PlatformFeeBps = 250
	// PlatformReleaseWindowHours is 48 hours. Shorter than the old 7-day
	// constant; fast enough for Nigerian sellers, long enough for buyers.
	PlatformReleaseWindowHours = 48
	// MaxReleaseWindowHours is the ceiling a partner can request.
	MaxReleaseWindowHours = 120 // 5 days
	// PlatformDeliveryFeeKobo is the fallback delivery fee when a seller has
	// not configured their own delivery zones. ₦1,500.
	PlatformDeliveryFeeKobo int64 = 150_000
)

type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
	Update(ctx context.Context, user *User) error
}

type Wallet struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    string    `gorm:"type:uuid;not null;uniqueIndex" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"-"`
	Balance   int64     `gorm:"type:bigint;default:0;not null" json:"balance"` // Balance in Kobo
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type WalletRepository interface {
	GetByUserID(ctx context.Context, userID string) (*Wallet, error)
	UpdateBalance(ctx context.Context, userID string, amount int64) error
	Create(ctx context.Context, wallet *Wallet) error
}

// EmailOTP is a one-time code sent by email. Only an HMAC of the code is
// stored; a row is single-use and expires.
type EmailOTP struct {
	ID         uint      `gorm:"primaryKey;autoIncrement"`
	UserID     string    `gorm:"type:uuid;index;not null"`
	Purpose    string    `gorm:"type:varchar(30);not null"` // verify_email
	CodeHash   string    `gorm:"type:varchar(64);not null"`
	Attempts   int       `gorm:"type:integer;default:0;not null"`
	ExpiresAt  time.Time `gorm:"not null"`
	ConsumedAt *time.Time
	CreatedAt  time.Time
}

// RefreshToken is one link in a rotating refresh-token family. Only the
// SHA-256 of the token is stored. Presenting a revoked token revokes the
// whole family (reuse detection).
type RefreshToken struct {
	ID        string    `gorm:"type:uuid;primaryKey"`
	UserID    string    `gorm:"type:uuid;index;not null"`
	FamilyID  string    `gorm:"type:uuid;index;not null"`
	TokenHash string    `gorm:"type:varchar(64);uniqueIndex;not null"`
	ExpiresAt time.Time `gorm:"not null"`
	RevokedAt *time.Time
	CreatedAt time.Time
}
