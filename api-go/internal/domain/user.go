package domain

import (
	"context"
	"time"
)

type User struct {
	ID           string    `gorm:"type:uuid;primaryKey" json:"id"`
	Name         string    `gorm:"type:varchar(100);not null" json:"name" binding:"required"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email" binding:"required,email"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	Phone        string    `gorm:"type:varchar(20)" json:"phone"`
	Role         string    `gorm:"type:varchar(20);default:'buyer'" json:"role" binding:"required,oneof=buyer seller artisan admin"`
	Status       string    `gorm:"type:varchar(20);default:'active'" json:"status"` // active, suspended
	Jurisdiction string    `gorm:"type:varchar(80)" json:"jurisdiction"`            // Nigerian state the user operates in
	Verified     bool      `gorm:"type:boolean;default:false" json:"verified"`      // quality-checked / verified badge
	CACNumber    string    `gorm:"type:varchar(30)" json:"cac_number"`              // business registration (sellers/artisans)
	KYCStatus    string    `gorm:"type:varchar(20);default:'unverified'" json:"kyc_status"` // unverified, pending, verified, failed
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
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

type UserService interface {
	Register(ctx context.Context, name, email, password, phone, role string) (*User, string, error)
	Login(ctx context.Context, email, password string) (*User, string, error)
	ValidateToken(ctx context.Context, tokenStr string) (*User, error)
	GetWallet(ctx context.Context, userID string) (*Wallet, error)
	CreditWallet(ctx context.Context, userID string, amount int64) error
}
