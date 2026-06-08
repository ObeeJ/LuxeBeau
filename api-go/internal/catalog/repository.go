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

func (r *gormProductRepository) GetByID(ctx context.Context, id uint) (*domain.Product, error) {
	var prod domain.Product
	if err := r.db.WithContext(ctx).First(&prod, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &prod, nil
}

func (r *gormProductRepository) List(ctx context.Context, category string, search string, limit, offset int) ([]domain.Product, error) {
	var products []domain.Product
	query := r.db.WithContext(ctx)

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
