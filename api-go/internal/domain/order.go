package domain

import (
	"context"
	"time"
)

type OrderItem struct {
	ID        uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID   string  `gorm:"type:varchar(50);not null" json:"order_id"`
	ProductID uint    `gorm:"not null" json:"product_id"`
	Product   Product `gorm:"foreignKey:ProductID" json:"product"`
	Qty       int     `gorm:"type:integer;not null" json:"qty"`
	Price     int64   `gorm:"type:bigint;not null" json:"price"` // Price at checkout, in Kobo
	// Fulfilment is tracked per item because one order can span sellers.
	FulfillmentStatus string     `gorm:"type:varchar(20);not null;default:'pending'" json:"fulfillment_status"` // pending, processing, shipped, delivered
	TrackingNote      string     `gorm:"type:varchar(200)" json:"tracking_note"`
	ShippedAt         *time.Time `json:"shipped_at"`
	DeliveredAt       *time.Time `json:"delivered_at"`
}

// Fulfilment stages, in order. Sellers can only move items forward.
var FulfillmentStages = []string{"pending", "processing", "shipped", "delivered"}

// FulfillmentRank returns a stage's position, or -1 for an unknown value.
func FulfillmentRank(stage string) int {
	for i, s := range FulfillmentStages {
		if s == stage {
			return i
		}
	}
	return -1
}

type Order struct {
	ID             string      `gorm:"type:varchar(50);primaryKey" json:"id"` // LB-XXXXXX
	BuyerID        string      `gorm:"type:uuid;not null" json:"buyer_id"`
	Buyer          User        `gorm:"foreignKey:BuyerID" json:"buyer"`
	Items          []OrderItem `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"items"`
	Subtotal       int64       `gorm:"type:bigint;not null" json:"subtotal"`
	DeliveryFee    int64       `gorm:"type:bigint;not null" json:"delivery_fee"`
	Total          int64       `gorm:"type:bigint;not null" json:"total"`
	PaymentMethod  string      `gorm:"type:varchar(50);not null" json:"payment_method"`
	PaymentStatus  string      `gorm:"type:varchar(20);default:'pending'" json:"payment_status"`  // pending, paid, failed, refunded
	ShippingStatus string      `gorm:"type:varchar(20);default:'pending'" json:"shipping_status"` // pending, processing, shipped, delivered, cancelled
	Address        string      `gorm:"type:text;not null" json:"address"`
	City           string      `gorm:"type:varchar(100);not null" json:"city"`
	State          string      `gorm:"type:varchar(100);not null" json:"state"`
	Phone          string      `gorm:"type:varchar(20);not null" json:"phone"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type OrderRepository interface {
	CreateOrder(ctx context.Context, order *Order) error
	GetOrderByID(ctx context.Context, id string) (*Order, error)
	ListOrdersByBuyer(ctx context.Context, buyerID string) ([]Order, error)
	UpdatePaymentStatus(ctx context.Context, id string, status string) error
	UpdateShippingStatus(ctx context.Context, id string, status string) error
}

type OrderService interface {
	CreateCheckout(ctx context.Context, buyerID string, items []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}, address, city, state, phone, payMethod string) (*Order, error)
	GetOrderDetails(ctx context.Context, orderID string) (*Order, error)
	ListMyOrders(ctx context.Context, buyerID string) ([]Order, error)
	ProcessPaystackWebhook(ctx context.Context, reference string, status string) error
}
