package promotion

import (
	"context"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

type GormRepository struct {
	db *gorm.DB
}

func NewGormRepository(db *gorm.DB) *GormRepository {
	return &GormRepository{db: db}
}

func (r *GormRepository) Create(ctx context.Context, ad *domain.FeaturedAd) error {
	return r.db.WithContext(ctx).Create(ad).Error
}

func (r *GormRepository) GetByID(ctx context.Context, id string) (*domain.FeaturedAd, error) {
	var ad domain.FeaturedAd
	if err := r.db.WithContext(ctx).First(&ad, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &ad, nil
}

func (r *GormRepository) ListActive(ctx context.Context, limit int) ([]domain.FeaturedAd, error) {
	now := time.Now().UTC()
	var ads []domain.FeaturedAd
	query := r.db.WithContext(ctx).
		Where("status = ? AND starts_at <= ? AND expires_at >= ?", domain.PromotionStatusActive, now, now).
		Order("created_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&ads).Error; err != nil {
		return nil, err
	}
	return ads, nil
}

func (r *GormRepository) ListByMerchant(ctx context.Context, merchantID string) ([]domain.FeaturedAd, error) {
	var ads []domain.FeaturedAd
	err := r.db.WithContext(ctx).
		Where("merchant_id = ?", merchantID).
		Order("created_at DESC").
		Find(&ads).Error
	return ads, err
}

func (r *GormRepository) ListAll(ctx context.Context, limit, offset int) ([]domain.FeaturedAd, int64, error) {
	var count int64
	var ads []domain.FeaturedAd
	if err := r.db.WithContext(ctx).Model(&domain.FeaturedAd{}).Count(&count).Error; err != nil {
		return nil, 0, err
	}
	err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&ads).Error
	return ads, count, err
}

func (r *GormRepository) UpdateStatus(ctx context.Context, id string, status domain.PromotionStatus) error {
	return r.db.WithContext(ctx).
		Model(&domain.FeaturedAd{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *GormRepository) IncrementImpression(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).
		Model(&domain.FeaturedAd{}).
		Where("id = ?", id).
		UpdateColumn("impressions_count", gorm.Expr("impressions_count + 1")).Error
}

func (r *GormRepository) IncrementClick(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).
		Model(&domain.FeaturedAd{}).
		Where("id = ?", id).
		UpdateColumn("clicks_count", gorm.Expr("clicks_count + 1")).Error
}
