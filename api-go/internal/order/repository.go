package order

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"luxebeau/internal/domain"
)

type gormOrderRepository struct {
	db *gorm.DB
}

func NewGormOrderRepository(db *gorm.DB) domain.OrderRepository {
	return &gormOrderRepository{db: db}
}

func (r *gormOrderRepository) CreateOrder(ctx context.Context, order *domain.Order) error {
	return r.db.WithContext(ctx).Create(order).Error
}

func (r *gormOrderRepository) GetOrderByID(ctx context.Context, id string) (*domain.Order, error) {
	var order domain.Order
	if err := r.db.WithContext(ctx).Preload("Items.Product").Preload("Buyer").First(&order, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &order, nil
}

func (r *gormOrderRepository) ListOrdersByBuyer(ctx context.Context, buyerID string) ([]domain.Order, error) {
	var orders []domain.Order
	if err := r.db.WithContext(ctx).Preload("Items.Product").Where("buyer_id = ?", buyerID).Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}

func (r *gormOrderRepository) UpdatePaymentStatus(ctx context.Context, id string, status string) error {
	return r.db.WithContext(ctx).Model(&domain.Order{}).Where("id = ?", id).Update("payment_status", status).Error
}

func (r *gormOrderRepository) UpdateShippingStatus(ctx context.Context, id string, status string) error {
	return r.db.WithContext(ctx).Model(&domain.Order{}).Where("id = ?", id).Update("shipping_status", status).Error
}
