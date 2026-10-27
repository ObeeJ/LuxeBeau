package escrow

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// GatewayAccount is the ledger account for money that came from a payment
// gateway rather than a wallet. Keeping it apart from user ids lets the wallet
// audit tell wallet money from card money.
const GatewayAccount = "gateway"

type sellerShare struct {
	SellerID string
	Total    int64
}

// HoldOrder puts a paid order's money into custody. Each seller gets one
// funded escrow for the value of their own items, so every seller is paid
// separately and only when their goods arrive. The delivery fee stays with the
// platform. It must run in the same transaction that marks the order paid, so
// an order is never paid without its money held.
//
// It is idempotent: if the order already has escrows it returns them.
func HoldOrder(tx *gorm.DB, o *domain.Order) ([]domain.Escrow, error) {
	var existing []domain.Escrow
	if err := tx.Where("kind = ? AND reference = ?", domain.EscrowKindOrder, o.ID).Find(&existing).Error; err != nil {
		return nil, err
	}
	if len(existing) > 0 {
		return existing, nil
	}

	var shares []sellerShare
	if err := tx.Table("order_items").
		Select("products.seller_id AS seller_id, CAST(SUM(order_items.price * order_items.qty) AS BIGINT) AS total").
		Joins("JOIN products ON products.id = order_items.product_id").
		Where("order_items.order_id = ?", o.ID).
		Group("products.seller_id").
		Order("products.seller_id").
		Scan(&shares).Error; err != nil {
		return nil, err
	}
	if len(shares) == 0 {
		return nil, fmt.Errorf("order %s has no items to hold", o.ID)
	}
	var sum int64
	for _, s := range shares {
		if s.SellerID == "" {
			return nil, fmt.Errorf("order %s has an item with no seller", o.ID)
		}
		sum += s.Total
	}
	if sum != o.Subtotal {
		return nil, fmt.Errorf("order %s items total %d but subtotal is %d", o.ID, sum, o.Subtotal)
	}

	// Wallet money leaves the buyer's own account; anything else came through a gateway.
	from := GatewayAccount
	if o.PaymentMethod == "wallet" {
		from = o.BuyerID
	}

	now := time.Now()
	held := make([]domain.Escrow, 0, len(shares))
	for _, s := range shares {
		e := domain.Escrow{
			ID:             newID(),
			Kind:           domain.EscrowKindOrder,
			Reference:      o.ID,
			BuyerID:        o.BuyerID,
			PayeeID:        s.SellerID,
			Title:          "Order " + o.ID,
			Amount:         s.Total,
			FeeBps:         domain.DefaultFeeBps,
			State:          domain.EscrowFunded,
			SettlementRail: domain.RailHeld,
			DeliveryCity:   o.City,
			FundedAt:       &now,
			// ReleaseEligibleAt stays empty until the seller marks the
			// goods delivered; only then does the buyer's window start.
		}
		if err := tx.Create(&e).Error; err != nil {
			return nil, err
		}
		if err := writeLedger(tx, e.ID, "fund", from, "escrow", e.Amount, "order paid, held until delivery"); err != nil {
			return nil, err
		}
		held = append(held, e)
	}
	if o.DeliveryFee > 0 {
		if err := writeLedger(tx, held[0].ID, "delivery", from, "platform", o.DeliveryFee, "delivery fee"); err != nil {
			return nil, err
		}
	}
	return held, nil
}

func writeLedger(tx *gorm.DB, escrowID, typ, from, to string, amount int64, memo string) error {
	entry := &domain.LedgerEntry{EscrowID: escrowID, Type: typ, FromAccount: from, ToAccount: to, Amount: amount, Memo: memo}
	if err := tx.Create(entry).Error; err != nil {
		return fmt.Errorf("ledger write: %w", err)
	}
	return nil
}

// returnDeliveryFee gives the buyer the delivery fee back once every seller's
// part of the order has been refunded: if none of the goods arrived there is
// nothing to charge delivery for. If any part was paid out the fee stays, since
// the buyer did receive something. It runs inside the refund's transaction and
// returns the fee at most once.
func returnDeliveryFee(tx *gorm.DB, refunded *domain.Escrow) error {
	var parts []domain.Escrow
	if err := tx.Where("kind = ? AND reference = ?", domain.EscrowKindOrder, refunded.Reference).Find(&parts).Error; err != nil {
		return err
	}
	ids := make([]string, len(parts))
	for i, p := range parts {
		if p.State != domain.EscrowRefunded {
			return nil // another seller's share is still held, disputed or paid out
		}
		ids[i] = p.ID
	}

	var fee int64
	if err := tx.Model(&domain.LedgerEntry{}).
		Where("escrow_id IN ? AND type = ?", ids, "delivery").
		Select("COALESCE(SUM(amount), 0)").Scan(&fee).Error; err != nil {
		return err
	}
	if fee == 0 {
		return nil
	}
	var returned int64
	if err := tx.Model(&domain.LedgerEntry{}).
		Where("escrow_id IN ? AND type = ? AND from_account = ?", ids, "refund", "platform").
		Count(&returned).Error; err != nil {
		return err
	}
	if returned > 0 {
		return nil
	}
	if err := adjust(tx, refunded.BuyerID, fee); err != nil {
		return err
	}
	return writeLedger(tx, refunded.ID, "refund", "platform", refunded.BuyerID, fee, "delivery fee returned: nothing was delivered")
}
