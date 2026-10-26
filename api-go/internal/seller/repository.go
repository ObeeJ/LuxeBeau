// Package seller is the seller-facing surface: a seller manages only their own
// products and sees only orders that contain their products. Routes are gated by
// auth.RequireRole("seller", "admin"). It uses its own gorm repository so the
// shared domain.ProductRepository interface (and its test mocks) stays frozen.
package seller

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

type Repository interface {
	ListProducts(ctx context.Context, sellerID string) ([]domain.Product, error)
	GetProduct(ctx context.Context, id uint) (*domain.Product, error)
	CreateProduct(ctx context.Context, p *domain.Product) error
	UpdateProduct(ctx context.Context, p *domain.Product) error
	DeleteProduct(ctx context.Context, id uint) error
	ListSales(ctx context.Context, sellerID string) ([]domain.Order, error)
	Fulfil(ctx context.Context, sellerID, orderID, stage, note string, at time.Time) (*Fulfilment, error)
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

// ListSales returns orders that include at least one of the seller's
// products, newest first. Each order carries only this seller's items, the
// buyer's name, and (once paid) the delivery details needed to ship.
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
	ownItems := func(db *gorm.DB) *gorm.DB {
		return db.Select("order_items.*").Joins("JOIN products ON products.id = order_items.product_id").
			Where("products.seller_id = ?", sellerID)
	}
	var orders []domain.Order
	if err := r.db.WithContext(ctx).
		Preload("Items", ownItems).Preload("Items.Product").
		Preload("Buyer", func(db *gorm.DB) *gorm.DB { return db.Select("id", "name") }).
		Where("id IN ?", ids).
		Order("created_at DESC").
		Find(&orders).Error; err != nil {
		return nil, err
	}
	for i := range orders {
		o := &orders[i]
		// Other sellers' share of the order is not this seller's business.
		var sub int64
		for _, it := range o.Items {
			sub += it.Price * int64(it.Qty)
		}
		o.Subtotal, o.Total, o.DeliveryFee = sub, sub, 0
		if o.PaymentStatus != "paid" {
			o.Address, o.Phone = "", ""
		}
	}
	return orders, nil
}

// Fulfilment is what changed, for the buyer notification.
type Fulfilment struct {
	Order     domain.Order
	Items     []string
	Stage     string
	Advanced  bool // at least one item moved to Stage
	Notify    bool // Stage is shipped or delivered and something advanced
	BuyerName string
	BuyerMail string
}

var (
	ErrSaleNotFound = errors.New("sale not found")
	ErrNotPaid      = errors.New("order not paid")
	ErrBackwards    = errors.New("fulfilment can only move forward")
	ErrInvalidStage = errors.New("invalid fulfilment stage")
	ErrOrderClosed  = errors.New("order is cancelled")
)

// Fulfil moves this seller's items in an order to a later stage and
// recomputes the order's overall shipping status as its slowest item.
func (r *gormRepository) Fulfil(ctx context.Context, sellerID, orderID, stage, note string, at time.Time) (*Fulfilment, error) {
	rank := domain.FulfillmentRank(stage)
	if rank <= 0 { // "pending" is the starting point, not a target
		return nil, ErrInvalidStage
	}
	out := &Fulfilment{Stage: stage}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, "id = ?", orderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrSaleNotFound
			}
			return err
		}
		var mine []domain.OrderItem
		if err := tx.Preload("Product").Select("order_items.*").
			Joins("JOIN products ON products.id = order_items.product_id").
			Where("order_items.order_id = ? AND products.seller_id = ?", orderID, sellerID).
			Find(&mine).Error; err != nil {
			return err
		}
		if len(mine) == 0 {
			return ErrSaleNotFound
		}
		if order.ShippingStatus == "cancelled" {
			return ErrOrderClosed
		}
		if order.PaymentStatus != "paid" {
			return ErrNotPaid
		}
		for _, it := range mine {
			if domain.FulfillmentRank(it.FulfillmentStatus) > rank {
				return ErrBackwards
			}
		}
		for _, it := range mine {
			updates := map[string]any{}
			if note != "" { // an empty note keeps the one already given
				updates["tracking_note"] = note
			}
			if domain.FulfillmentRank(it.FulfillmentStatus) < rank {
				out.Advanced = true
				updates["fulfillment_status"] = stage
				if rank >= domain.FulfillmentRank("shipped") && it.ShippedAt == nil {
					updates["shipped_at"] = at
				}
				if stage == "delivered" {
					updates["delivered_at"] = at
				}
			}
			if len(updates) > 0 {
				if err := tx.Model(&domain.OrderItem{}).Where("id = ?", it.ID).Updates(updates).Error; err != nil {
					return err
				}
			}
			out.Items = append(out.Items, it.Product.Name)
		}

		// The order as a whole is only as far along as its slowest item.
		var stages []string
		if err := tx.Model(&domain.OrderItem{}).Where("order_id = ?", orderID).Pluck("fulfillment_status", &stages).Error; err != nil {
			return err
		}
		slowest := len(domain.FulfillmentStages) - 1
		for _, st := range stages {
			if rk := domain.FulfillmentRank(st); rk >= 0 && rk < slowest {
				slowest = rk
			}
		}
		overall := domain.FulfillmentStages[slowest]
		if err := tx.Model(&domain.Order{}).Where("id = ?", orderID).Update("shipping_status", overall).Error; err != nil {
			return err
		}
		order.ShippingStatus = overall

		var buyer domain.User
		if err := tx.Select("id", "name", "email").First(&buyer, "id = ?", order.BuyerID).Error; err == nil {
			out.BuyerName, out.BuyerMail = buyer.Name, buyer.Email
		}
		out.Order = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	out.Notify = out.Advanced && (stage == "shipped" || stage == "delivered")
	return out, nil
}
