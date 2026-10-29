package escrow

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
	"luxebeau/internal/influencer"
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

	// Load seller accounts once to read their per-partner fee and release window.
	sellerIDs := make([]string, len(shares))
	for i, s := range shares {
		sellerIDs[i] = s.SellerID
	}
	var sellers []domain.User
	if err := tx.Select("id", "fee_bps", "release_window_hours").
		Where("id IN ?", sellerIDs).Find(&sellers).Error; err != nil {
		return nil, err
	}
	sellerMap := make(map[string]*domain.User, len(sellers))
	for i := range sellers {
		sellerMap[sellers[i].ID] = &sellers[i]
	}

	// Wallet money leaves the buyer's own account; anything else came through a gateway.
	from := GatewayAccount
	if o.PaymentMethod == "wallet" {
		from = o.BuyerID
	}

	now := time.Now()
	held := make([]domain.Escrow, 0, len(shares))
	for _, s := range shares {
		feeBps := domain.PlatformFeeBps
		if seller, ok := sellerMap[s.SellerID]; ok {
			feeBps = seller.EffectiveFeeBps()
		}
		e := domain.Escrow{
			ID:             newID(),
			Kind:           domain.EscrowKindOrder,
			Reference:      o.ID,
			BuyerID:        o.BuyerID,
			PayeeID:        s.SellerID,
			Title:          "Order " + o.ID,
			Amount:         s.Total,
			FeeBps:         feeBps,
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
		// Create influencer commission if this order was referred.
		if err := influencer.CreateCommission(tx, o.ID, e.ID, s.Total, feeBps); err != nil {
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

// ── Booking escrow ──────────────────────────────────────────────────────────
//
// Best-practice flow for Nigerian beauty services:
//   1. Client requests a booking (no money yet — artisan may decline).
//   2. Artisan confirms → client is prompted to pay → HoldBooking is called
//      in the same transaction that marks the booking confirmed+paid.
//   3. Artisan marks the appointment completed → ReleaseBooking pays the artisan.
//   4. Artisan marks no-show → RefundBookingNoShow: artisan keeps their
//      configured no-show fee, client gets the rest back.
//   5. Either side cancels before the appointment → RefundBookingCancel: full
//      refund to the client, nothing to the artisan.
//
// This solves the biggest Nigerian artisan problem: clients who book and ghost,
// wasting the artisan's slot and time.

// HoldBooking creates a funded escrow for a confirmed booking. It must run
// inside the transaction that marks the booking confirmed so the booking is
// never confirmed without its payment held.
func HoldBooking(tx *gorm.DB, b *domain.Booking, artisan *domain.User) (*domain.Escrow, error) {
	// Idempotent: if an escrow already exists for this booking, return it.
	if b.EscrowID != "" {
		var existing domain.Escrow
		if err := tx.First(&existing, "id = ?", b.EscrowID).Error; err == nil {
			return &existing, nil
		}
	}

	now := time.Now()
	e := domain.Escrow{
		ID:             newID(),
		Kind:           domain.EscrowKindBooking,
		Reference:      b.ID,
		BuyerID:        b.BuyerID,
		PayeeID:        artisan.ID,
		Title:          b.ServiceName + " booking",
		Amount:         b.Amount,
		FeeBps:         artisan.EffectiveFeeBps(),
		State:          domain.EscrowFunded,
		SettlementRail: domain.RailHeld,
		ServiceType:    b.ServiceType,
		FundedAt:       &now,
		// ReleaseEligibleAt is not set here: the artisan must mark the
		// appointment completed before the auto-release clock starts.
	}
	if err := tx.Create(&e).Error; err != nil {
		return nil, err
	}
	if err := writeLedger(tx, e.ID, "fund", b.BuyerID, "escrow", b.Amount, "booking payment held"); err != nil {
		return nil, err
	}
	// Debit the client's wallet.
	if err := adjust(tx, b.BuyerID, -b.Amount); err != nil {
		return nil, fmt.Errorf("booking escrow: debit client wallet: %w", err)
	}
	// Link the escrow back to the booking.
	if err := tx.Model(&domain.Booking{}).Where("id = ?", b.ID).
		Update("escrow_id", e.ID).Error; err != nil {
		return nil, err
	}
	return &e, nil
}

// ReleaseBooking pays the artisan after they mark the appointment completed.
// It runs inside the CompleteBooking transaction.
func ReleaseBooking(tx *gorm.DB, escrowID string) error {
	if escrowID == "" {
		return nil // booking had no escrow (pre-escrow or test bookings)
	}
	var e domain.Escrow
	if err := tx.First(&e, "id = ?", escrowID).Error; err != nil {
		return fmt.Errorf("booking escrow not found: %w", err)
	}
	if e.State != domain.EscrowFunded {
		return nil // already resolved (idempotent)
	}
	fee, net := e.Fee()
	if err := adjust(tx, e.PayeeID, net); err != nil {
		return fmt.Errorf("booking release: credit artisan: %w", err)
	}
	now := time.Now()
	if err := tx.Model(&e).Updates(map[string]any{
		"state": domain.EscrowReleased, "resolved_at": now,
	}).Error; err != nil {
		return err
	}
	if err := writeLedger(tx, e.ID, "release", "escrow", e.PayeeID, net, "booking completed"); err != nil {
		return err
	}
	if fee > 0 {
		return writeLedger(tx, e.ID, "fee", "escrow", "platform", fee, "platform fee")
	}
	return nil
}

// RefundBookingNoShow handles a client no-show: the artisan keeps their
// configured no-show fee (b.NoShowFeeBps of the booking amount), the rest
// goes back to the client. Runs inside the MarkNoShow transaction.
func RefundBookingNoShow(tx *gorm.DB, b *domain.Booking) error {
	if b.EscrowID == "" {
		return nil // booking had no escrow (pre-escrow bookings)
	}
	var e domain.Escrow
	if err := tx.First(&e, "id = ?", b.EscrowID).Error; err != nil {
		return fmt.Errorf("booking escrow not found: %w", err)
	}
	if e.State != domain.EscrowFunded {
		return nil
	}
	artisanKeeps := e.Amount * int64(b.NoShowFeeBps) / 10000
	clientGets := e.Amount - artisanKeeps
	now := time.Now()
	if err := tx.Model(&e).Updates(map[string]any{
		"state": domain.EscrowRefunded, "resolved_at": now,
	}).Error; err != nil {
		return err
	}
	if clientGets > 0 {
		if err := adjust(tx, e.BuyerID, clientGets); err != nil {
			return fmt.Errorf("no-show refund: credit client: %w", err)
		}
		if err := writeLedger(tx, e.ID, "refund", "escrow", e.BuyerID, clientGets, "no-show partial refund"); err != nil {
			return err
		}
	}
	if artisanKeeps > 0 {
		if err := adjust(tx, e.PayeeID, artisanKeeps); err != nil {
			return fmt.Errorf("no-show fee: credit artisan: %w", err)
		}
		if err := writeLedger(tx, e.ID, "no_show_fee", "escrow", e.PayeeID, artisanKeeps, "no-show fee retained by artisan"); err != nil {
			return err
		}
	}
	return nil
}

// RefundBookingCancel returns the full booking amount to the client.
// Called when either side cancels before the appointment starts.
func RefundBookingCancel(tx *gorm.DB, escrowID, buyerID string) error {
	if escrowID == "" {
		return nil
	}
	var e domain.Escrow
	if err := tx.First(&e, "id = ?", escrowID).Error; err != nil {
		return fmt.Errorf("booking escrow not found: %w", err)
	}
	if e.State != domain.EscrowFunded {
		return nil
	}
	now := time.Now()
	if err := tx.Model(&e).Updates(map[string]any{
		"state": domain.EscrowRefunded, "resolved_at": now,
	}).Error; err != nil {
		return err
	}
	if err := adjust(tx, e.BuyerID, e.Amount); err != nil {
		return fmt.Errorf("cancel refund: credit client: %w", err)
	}
	return writeLedger(tx, e.ID, "refund", "escrow", e.BuyerID, e.Amount, "booking cancelled, full refund")
}
