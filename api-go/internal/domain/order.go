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
	// PlatformFee is LuxeBeau's fee, paid by the buyer on top of the goods.
	PlatformFee int64 `gorm:"type:bigint;not null;default:0" json:"platform_fee"`
	// ProcessingFee is the payment gateway's cut, also paid by the buyer (card
	// payments only).
	ProcessingFee int64 `gorm:"type:bigint;not null;default:0" json:"processing_fee"`
	// DeliverySplit says how DeliveryFee is divided between the sellers, as JSON
	// {"seller-id": kobo}. It is empty on orders placed before sellers kept their
	// own delivery fee, which are held under the old rules.
	DeliverySplit string `gorm:"type:text" json:"-"`
	Total         int64  `gorm:"type:bigint;not null" json:"total"`
	PaymentMethod  string      `gorm:"type:varchar(50);not null" json:"payment_method"`
	PaymentStatus  string      `gorm:"type:varchar(20);default:'pending'" json:"payment_status"`  // pending, paid, failed, refunded
	ShippingStatus string      `gorm:"type:varchar(20);default:'pending'" json:"shipping_status"` // pending, processing, shipped, delivered, cancelled
	Address        string      `gorm:"type:text;not null" json:"address"`
	City           string      `gorm:"type:varchar(100);not null" json:"city"`
	State          string      `gorm:"type:varchar(100);not null" json:"state"`
	Phone          string      `gorm:"type:varchar(20);not null" json:"phone"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
	// Holds are the escrows holding this order's money, one per seller. They
	// are loaded on demand and never stored on the order.
	Holds []OrderHold `gorm:"-" json:"holds,omitempty"`
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
	// QuoteCheckout prices a cart exactly as CreateCheckout would charge it,
	// without holding stock or moving any money.
	QuoteCheckout(ctx context.Context, items []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}, city, payMethod string) (*OrderPrice, error)
	GetOrderDetails(ctx context.Context, orderID string) (*Order, error)
	ListMyOrders(ctx context.Context, buyerID string) ([]Order, error)
	// ConfirmPayment applies a verified payment-provider notification.
	ConfirmPayment(ctx context.Context, n PaymentNotice) (PaymentOutcome, error)
	// VerifyPayment queries the payment gateway directly as a fallback to confirm an order.
	VerifyPayment(ctx context.Context, orderID string, reference string) (*Order, error)
}

// PaymentNotice is a provider's report about one order's payment, already
// signature-checked by the webhook middleware. Amount is in kobo.
type PaymentNotice struct {
	Provider  string
	Reference string // our order ID
	Succeeded bool
	Amount    int64
	Currency  string
}

// PaymentOutcome says what a notice did to the order.
type PaymentOutcome string

const (
	PaymentMarkedPaid    PaymentOutcome = "paid"
	PaymentMarkedFailed  PaymentOutcome = "failed"
	PaymentIgnored       PaymentOutcome = "ignored"        // duplicate, or a failure after payment
	PaymentUnknownOrder  PaymentOutcome = "unknown_order"  // no order with that reference
	PaymentAmountInvalid PaymentOutcome = "amount_invalid" // success, but wrong amount or currency
)
