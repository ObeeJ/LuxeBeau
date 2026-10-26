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
	CACNumber     string     `gorm:"type:varchar(30)" json:"cac_number"`                      // business registration (sellers/artisans)
	KYCStatus     string     `gorm:"type:varchar(20);default:'unverified'" json:"kyc_status"` // unverified, pending, verified, failed
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

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
