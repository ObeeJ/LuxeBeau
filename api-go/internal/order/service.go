package order

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"luxebeau/internal/domain"
	"luxebeau/internal/escrow"
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
		// Defence in depth: a non-positive quantity would add stock and make
		// the total negative (crediting a wallet payment).
		if item.Qty < 1 || item.Qty > 100 {
			tx.Rollback()
			return nil, fmt.Errorf("invalid quantity for product %d", item.ProductID)
		}
		var prod domain.Product
		// Lock the row for update to prevent race conditions (native GORM v2 clause).
		// Only products from admin-approved sellers can be bought.
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("seller_id IN (?)", tx.Model(&domain.User{}).Select("id").Where("verified = ?", true)).
			First(&prod, item.ProductID).Error; err != nil {
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

	orderID, err := newOrderID()
	if err != nil {
		tx.Rollback()
		return nil, err
	}

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

	// A wallet order is paid at checkout, so its money goes into escrow in the
	// same transaction. Other payment methods are held when the payment is
	// confirmed (ConfirmPayment).
	if order.PaymentStatus == "paid" {
		if _, err := escrow.HoldOrder(tx, order); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to hold order payment: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	s.logger.Info("Order created", slog.String("id", orderID), slog.String("buyer", buyerID), slog.Int64("total", order.Total))
	return order, nil
}

// newOrderID returns LB- plus 8 random hex characters (2^32 possibilities;
// the old 5-digit IDs collided after a few hundred orders).
func newOrderID() (string, error) {
	b := make([]byte, 4)
	if _, err := crand.Read(b); err != nil {
		return "", fmt.Errorf("order id: %w", err)
	}
	return "LB-" + strings.ToUpper(hex.EncodeToString(b)), nil
}

func (s *orderService) GetOrderDetails(ctx context.Context, orderID string) (*domain.Order, error) {
	o, err := s.orderRepo.GetOrderByID(ctx, orderID)
	if err != nil || o == nil {
		return o, err
	}
	list := []domain.Order{*o}
	if err := s.attachHolds(ctx, list); err != nil {
		return nil, err
	}
	return &list[0], nil
}

func (s *orderService) ListMyOrders(ctx context.Context, buyerID string) ([]domain.Order, error) {
	orders, err := s.orderRepo.ListOrdersByBuyer(ctx, buyerID)
	if err != nil {
		return nil, err
	}
	if err := s.attachHolds(ctx, orders); err != nil {
		return nil, err
	}
	return orders, nil
}

// attachHolds loads the escrows holding each order's money, one per seller.
func (s *orderService) attachHolds(ctx context.Context, orders []domain.Order) error {
	if len(orders) == 0 {
		return nil
	}
	ids := make([]string, len(orders))
	index := make(map[string]int, len(orders))
	for i, o := range orders {
		ids[i] = o.ID
		index[o.ID] = i
	}
	var rows []struct {
		domain.Escrow
		SellerName string
	}
	if err := s.db.WithContext(ctx).Table("escrows").
		Select("escrows.*, users.name AS seller_name").
		Joins("LEFT JOIN users ON CAST(users.id AS TEXT) = CAST(escrows.payee_id AS TEXT)").
		Where("escrows.kind = ? AND escrows.reference IN ?", domain.EscrowKindOrder, ids).
		Order("escrows.created_at").
		Scan(&rows).Error; err != nil {
		return err
	}
	for _, r := range rows {
		_, net := r.Escrow.Fee()
		i := index[r.Reference]
		orders[i].Holds = append(orders[i].Holds, domain.OrderHold{
			ID: r.ID, State: r.State, Amount: r.Amount, Net: net,
			Seller: r.SellerName, ReleaseEligibleAt: r.ReleaseEligibleAt,
		})
	}
	return nil
}

// ConfirmPayment marks an order paid only when the provider reports success
// for exactly the order total in naira. A paid order is never moved back to
// failed (providers can send a stale failure after a retry succeeds), and
// each change is a conditional UPDATE so duplicate deliveries are no-ops.
func (s *orderService) ConfirmPayment(ctx context.Context, n domain.PaymentNotice) (domain.PaymentOutcome, error) {
	var order domain.Order
	err := s.db.WithContext(ctx).First(&order, "id = ?", n.Reference).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.PaymentUnknownOrder, nil
	}
	if err != nil {
		return "", err
	}

	if !n.Succeeded {
		res := s.db.WithContext(ctx).Model(&domain.Order{}).
			Where("id = ? AND payment_status = ?", order.ID, "pending").
			Update("payment_status", "failed")
		if res.Error != nil {
			return "", res.Error
		}
		if res.RowsAffected == 0 {
			return domain.PaymentIgnored, nil
		}
		return domain.PaymentMarkedFailed, nil
	}

	if n.Amount != order.Total || !strings.EqualFold(n.Currency, "NGN") {
		s.logger.Warn("payment amount mismatch; order left unpaid",
			slog.String("order", order.ID), slog.String("provider", n.Provider),
			slog.Int64("expected", order.Total), slog.Int64("received", n.Amount), slog.String("currency", n.Currency))
		return domain.PaymentAmountInvalid, nil
	}

	// Marking the order paid and holding its money are one transaction: if the
	// hold fails the order stays unpaid and the provider's retry tries again.
	outcome := domain.PaymentIgnored
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&domain.Order{}).
			Where("id = ? AND payment_status IN ?", order.ID, []string{"pending", "failed"}).
			Update("payment_status", "paid")
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil // already paid: duplicate notice
		}
		if _, err := escrow.HoldOrder(tx, &order); err != nil {
			return err
		}
		outcome = domain.PaymentMarkedPaid
		return nil
	})
	if err != nil {
		return "", err
	}
	return outcome, nil
}
