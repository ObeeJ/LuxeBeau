// Package seller is the seller-facing surface: a seller manages only their own
// products and sees only orders that contain their products. Routes are gated by
// auth.RequireRole("seller", "admin"). It uses its own gorm repository so the
// shared domain.ProductRepository interface (and its test mocks) stays frozen.
package seller

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

type Repository interface {
	ListProducts(ctx context.Context, sellerID string) ([]domain.Product, error)
	GetProduct(ctx context.Context, id uint) (*domain.Product, error)
	CreateProduct(ctx context.Context, p *domain.Product) error
	UpdateProduct(ctx context.Context, p *domain.Product) error
	DeleteProduct(ctx context.Context, id uint) error
	ListSales(ctx context.Context, sellerID string) ([]domain.Order, error)
}

type gormRepository struct {
	db *gorm.DB
}

func NewGormRepository(db *gorm.DB) Repository {
	return &gormRepository{db: db}
}

func (r *gormRepository) ListProducts(ctx context.Context, sellerID string) ([]domain.Product, error) {
	var products []domain.Product
	if err := r.db.WithContext(ctx).Where("seller_id = ?", sellerID).Order("created_at DESC").Find(&products).Error; err != nil {
		return nil, err
	}
	return products, nil
}

func (r *gormRepository) GetProduct(ctx context.Context, id uint) (*domain.Product, error) {
	var p domain.Product
	if err := r.db.WithContext(ctx).First(&p, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *gormRepository) CreateProduct(ctx context.Context, p *domain.Product) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *gormRepository) UpdateProduct(ctx context.Context, p *domain.Product) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *gormRepository) DeleteProduct(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.Product{}, id).Error
}

// ListSales returns orders that include at least one product owned by the
// seller, newest first, with items + product detail preloaded.
func (r *gormRepository) ListSales(ctx context.Context, sellerID string) ([]domain.Order, error) {
	var ids []string
	if err := r.db.WithContext(ctx).
		Model(&domain.OrderItem{}).
		Joins("JOIN products ON products.id = order_items.product_id").
		Where("products.seller_id = ?", sellerID).
		Distinct().
		Pluck("order_items.order_id", &ids).Error; err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []domain.Order{}, nil
	}
	var orders []domain.Order
	if err := r.db.WithContext(ctx).
		Preload("Items").Preload("Items.Product").
		Where("id IN ?", ids).
		Order("created_at DESC").
		Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}
