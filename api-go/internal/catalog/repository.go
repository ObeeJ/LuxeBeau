package catalog

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"luxebeau/internal/domain"
)

type gormProductRepository struct {
	db *gorm.DB
}

func NewGormProductRepository(db *gorm.DB) domain.ProductRepository {
	return &gormProductRepository{db: db}
}

func (r *gormProductRepository) Create(ctx context.Context, prod *domain.Product) error {
	return r.db.WithContext(ctx).Create(prod).Error
}

// approvedSellers limits a product query to sellers an admin has approved;
// this repository serves the public catalogue only.
func (r *gormProductRepository) approvedSellers(ctx context.Context) *gorm.DB {
	db := r.db.WithContext(ctx)
	return db.Where("products.seller_id IN (?)", db.Model(&domain.User{}).Select("id").Where("verified = ?", true))
}

func (r *gormProductRepository) GetByID(ctx context.Context, id uint) (*domain.Product, error) {
	var prod domain.Product
	if err := r.approvedSellers(ctx).First(&prod, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &prod, nil
}

func (r *gormProductRepository) List(ctx context.Context, category string, search string, limit, offset int) ([]domain.Product, error) {
	var products []domain.Product
	query := r.approvedSellers(ctx)

	if category != "" {
		query = query.Where("category = ?", category)
	}
	if search != "" {
		query = query.Where("name ILIKE ? OR brand ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&products).Error; err != nil {
		return nil, err
	}
	return products, nil
}

func (r *gormProductRepository) Update(ctx context.Context, prod *domain.Product) error {
	return r.db.WithContext(ctx).Save(prod).Error
}

func (r *gormProductRepository) UpdateStock(ctx context.Context, id uint, change int) error {
	return r.db.WithContext(ctx).Model(&domain.Product{}).
		Where("id = ? AND stock + ? >= 0", id, change).
		Update("stock", gorm.Expr("stock + ?", change)).Error
}
