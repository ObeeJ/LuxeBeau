package domain

import (
	"context"
	"time"
)

type User struct {
	ID           string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name         string    `gorm:"type:varchar(100);not null" json:"name" binding:"required"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email" binding:"required,email"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	Phone        string    `gorm:"type:varchar(20)" json:"phone"`
	Role         string    `gorm:"type:varchar(20);default:'buyer'" json:"role" binding:"required,oneof=buyer seller artisan admin"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
}

type UserService interface {
	Register(ctx context.Context, name, email, password, phone, role string) (*User, string, error)
	Login(ctx context.Context, email, password string) (*User, string, error)
	ValidateToken(ctx context.Context, tokenStr string) (*User, error)
}
