package auth

import (
	"context"

	"gorm.io/gorm"
	"luxebeau/internal/domain"
)

type gormUserRepository struct {
	db *gorm.DB
}

func NewGormUserRepository(db *gorm.DB) domain.UserRepository {
	return &gormUserRepository{db: db}
}

func (r *gormUserRepository) Create(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *gormUserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *gormUserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *gormUserRepository) Update(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

type gormWalletRepository struct {
	db *gorm.DB
}

func NewGormWalletRepository(db *gorm.DB) domain.WalletRepository {
	return &gormWalletRepository{db: db}
}

func (r *gormWalletRepository) Create(ctx context.Context, w *domain.Wallet) error {
	return r.db.WithContext(ctx).Create(w).Error
}

func (r *gormWalletRepository) GetByUserID(ctx context.Context, userID string) (*domain.Wallet, error) {
	var w domain.Wallet
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&w).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *gormWalletRepository) UpdateBalance(ctx context.Context, userID string, amount int64) error {
	return r.db.WithContext(ctx).Model(&domain.Wallet{}).
		Where("user_id = ?", userID).
		Update("balance", gorm.Expr("balance + ?", amount)).Error
}
