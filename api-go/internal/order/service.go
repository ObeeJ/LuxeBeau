package order

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"luxebeau/internal/domain"
)

type orderService struct {
	orderRepo   domain.OrderRepository
	productRepo domain.ProductRepository
	db          *gorm.DB
	logger      *slog.Logger
}

func NewOrderService(orderRepo domain.OrderRepository, productRepo domain.ProductRepository, db *gorm.DB, logger *slog.Logger) domain.OrderService {
	return &orderService{orderRepo: orderRepo, productRepo: productRepo, db: db, logger: logger}
}

func (s *orderService) CreateCheckout(ctx context.Context, buyerID string, items []struct {
	ProductID uint `json:"product_id"`
	Qty       int  `json:"qty"`
}, address, city, state, phone, payMethod string) (*domain.Order, error) {

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var orderItems []domain.OrderItem
	var subtotal int64

	for _, item := range items {
		var prod domain.Product
		// Lock the row for update to prevent race conditions (native GORM v2 clause)
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&prod, item.ProductID).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("product %d not found", item.ProductID)
		}
		if prod.Stock < item.Qty {
			tx.Rollback()
			return nil, fmt.Errorf("insufficient stock for %s (available: %d, requested: %d)", prod.Name, prod.Stock, item.Qty)
		}

		// Decrement stock
		prod.Stock -= item.Qty
		if err := tx.Save(&prod).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update stock: %w", err)
		}

		lineTotal := prod.Price * int64(item.Qty)
		subtotal += lineTotal

		orderItems = append(orderItems, domain.OrderItem{
			ProductID: item.ProductID,
			Qty:       item.Qty,
			Price:     prod.Price,
		})
	}

	// Calculate delivery fee (free above ₦10,000 = 1,000,000 kobo)
	var deliveryFee int64
	if subtotal < 1000000 {
		deliveryFee = 150000 // ₦1,500
	}

	orderID := fmt.Sprintf("LB-%05d", rand.Intn(90000)+10000)

	order := &domain.Order{
		ID:             orderID,
		BuyerID:        buyerID,
		Items:          orderItems,
		Subtotal:       subtotal,
		DeliveryFee:    deliveryFee,
		Total:          subtotal + deliveryFee,
		PaymentMethod:  payMethod,
		PaymentStatus:  "pending",
		ShippingStatus: "pending",
		Address:        address,
		City:           city,
		State:          state,
		Phone:          phone,
	}

	if payMethod == "wallet" {
		var wallet domain.Wallet
		if err := tx.Where("user_id = ?", buyerID).First(&wallet).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("wallet not found for buyer")
		}
		if wallet.Balance < order.Total {
			tx.Rollback()
			return nil, fmt.Errorf("insufficient wallet balance (available: %d kobo, required: %d kobo)", wallet.Balance, order.Total)
		}
		wallet.Balance -= order.Total
		if err := tx.Save(&wallet).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to deduct wallet balance: %w", err)
		}
		order.PaymentStatus = "paid"
	}

	if err := tx.Create(order).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	s.logger.Info("Order created", slog.String("id", orderID), slog.String("buyer", buyerID), slog.Int64("total", order.Total))
	return order, nil
}

func (s *orderService) GetOrderDetails(ctx context.Context, orderID string) (*domain.Order, error) {
	return s.orderRepo.GetOrderByID(ctx, orderID)
}

func (s *orderService) ListMyOrders(ctx context.Context, buyerID string) ([]domain.Order, error) {
	return s.orderRepo.ListOrdersByBuyer(ctx, buyerID)
}

func (s *orderService) ProcessPaystackWebhook(ctx context.Context, reference string, status string) error {
	if status == "success" {
		return s.orderRepo.UpdatePaymentStatus(ctx, reference, "paid")
	}
	return s.orderRepo.UpdatePaymentStatus(ctx, reference, "failed")
}
