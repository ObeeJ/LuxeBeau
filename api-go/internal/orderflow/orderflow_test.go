// Package orderflow tests the whole life of an order's money across packages:
// checkout, escrow, per-seller delivery, the buyer's window, auto-release,
// dispute and refund, and checks the wallet audit agrees with every step.
package orderflow

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/audit"
	"luxebeau/internal/domain"
	"luxebeau/internal/escrow"
	"luxebeau/internal/order"
	"luxebeau/internal/seller"
)

const (
	buyerID   = "buyer-1"
	sellerA   = "seller-a"
	sellerB   = "seller-b"
	startFund = int64(10_000_000) // ₦100,000 the buyer's wallet starts with
)

type env struct {
	db      *gorm.DB
	orders  domain.OrderService
	sellers *seller.Service
	escrows *escrow.Service
	prodA   domain.Product
	prodB   domain.Product
}

func setup(t *testing.T, name string) *env {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.Product{}, &domain.Order{}, &domain.OrderItem{}, &domain.Escrow{}, &domain.LedgerEntry{}, &domain.Artisan{}); err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	for _, u := range []domain.User{
		{ID: buyerID, Name: "Ada Buyer", Email: "ada@test.ng", Role: "buyer"},
		{ID: sellerA, Name: "Adunni Organics", Email: "a@test.ng", Role: "seller", Verified: true},
		{ID: sellerB, Name: "Zaria Roots", Email: "b@test.ng", Role: "seller", Verified: true},
	} {
		db.Create(&u)
		db.Create(&domain.Wallet{UserID: u.ID})
	}
	db.Model(&domain.Wallet{}).Where("user_id = ?", buyerID).Update("balance", startFund)

	e := &env{db: db}
	e.prodA = domain.Product{SellerID: sellerA, Name: "Black soap", Brand: "A", Price: 850_000, Category: "Skincare", Stock: 10}
	e.prodB = domain.Product{SellerID: sellerB, Name: "Shea butter", Brand: "B", Price: 1_200_000, Category: "Body", Stock: 10}
	db.Create(&e.prodA)
	db.Create(&e.prodB)

	e.orders = order.NewOrderService(&orderRepo{db}, &productRepo{db}, db, logger)
	e.sellers = seller.NewService(seller.NewGormRepository(db), logger)
	rails := escrow.NewRegistry(escrow.NewWalletSettlement(logger), escrow.NewHeldSettlement())
	e.escrows = escrow.NewService(escrow.NewGormRepository(db), rails, escrow.NewLogNotifier(logger), logger)
	return e
}

func (e *env) balance(id string) int64 {
	var w domain.Wallet
	e.db.First(&w, "user_id = ?", id)
	return w.Balance
}

func (e *env) holds(orderID string) map[string]domain.Escrow {
	var list []domain.Escrow
	e.db.Where("kind = ? AND reference = ?", domain.EscrowKindOrder, orderID).Find(&list)
	out := map[string]domain.Escrow{}
	for _, h := range list {
		out[h.PayeeID] = h
	}
	return out
}

// placeOrder buys 2 of seller A's soap and 1 of seller B's butter from the wallet.
func (e *env) placeOrder(t *testing.T) *domain.Order {
	t.Helper()
	items := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{{e.prodA.ID, 2}, {e.prodB.ID, 1}}
	o, err := e.orders.CreateCheckout(context.Background(), buyerID, items, "12 Admiralty Way", "Lagos", "Lagos", "08030000001", "wallet")
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	return o
}

func TestOrderMoneyLifecycle(t *testing.T) {
	e := setup(t, "orderflow_lifecycle")
	ctx := context.Background()

	// ── Checkout: the money is held, per seller, and nobody is paid yet ──
	o := e.placeOrder(t)
	soap, butter := int64(2*850_000), int64(1_200_000)
	if o.Subtotal != soap+butter {
		t.Fatalf("subtotal = %d, want %d", o.Subtotal, soap+butter)
	}
	if got := e.balance(buyerID); got != startFund-o.Total {
		t.Fatalf("buyer balance = %d, want %d (debited exactly the order total)", got, startFund-o.Total)
	}
	holds := e.holds(o.ID)
	if len(holds) != 2 || holds[sellerA].Amount != soap || holds[sellerB].Amount != butter {
		t.Fatalf("holds = %+v, want one escrow per seller worth %d and %d", holds, soap, butter)
	}
	for id, h := range holds {
		if h.State != domain.EscrowFunded || h.SettlementRail != domain.RailHeld || h.ReleaseEligibleAt != nil {
			t.Errorf("hold for %s: state=%s rail=%s release=%v; want funded, held rail, no release time yet", id, h.State, h.SettlementRail, h.ReleaseEligibleAt)
		}
	}
	if e.balance(sellerA) != 0 || e.balance(sellerB) != 0 {
		t.Fatal("a seller was paid before delivery")
	}

	// ── Seller A delivers: only A's window starts ──
	for _, stage := range []string{"processing", "shipped", "delivered"} {
		if _, err := e.sellers.Fulfil(ctx, sellerA, o.ID, stage, "GIG 4471"); err != nil {
			t.Fatalf("seller A %s: %v", stage, err)
		}
	}
	holds = e.holds(o.ID)
	a := holds[sellerA].ReleaseEligibleAt
	if a == nil || a.Before(time.Now().Add(domain.OrderReleaseWindow-time.Minute)) || a.After(time.Now().Add(domain.OrderReleaseWindow+time.Minute)) {
		t.Fatalf("seller A release time = %v, want about %v from now", a, domain.OrderReleaseWindow)
	}
	if holds[sellerB].ReleaseEligibleAt != nil {
		t.Fatal("seller B's window started before B delivered")
	}

	// Nothing is due yet, so the sweeper pays nobody.
	if n, err := e.escrows.SweepAutoReleases(ctx); err != nil || n != 0 {
		t.Fatalf("sweep inside the window: released %d, err %v; want 0", n, err)
	}
	// A repeated "delivered" doesn't extend the window.
	before := *a
	e.sellers.Fulfil(ctx, sellerA, o.ID, "delivered", "again")
	if again := e.holds(o.ID)[sellerA].ReleaseEligibleAt; !again.Equal(before) {
		t.Errorf("window moved from %v to %v", before, again)
	}

	// ── The window passes: the sweeper pays seller A, net of the 1% fee ──
	e.db.Model(&domain.Escrow{}).Where("id = ?", holds[sellerA].ID).Update("release_eligible_at", time.Now().Add(-time.Minute))
	if n, err := e.escrows.SweepAutoReleases(ctx); err != nil || n != 1 {
		t.Fatalf("sweep after the window: released %d, err %v; want 1", n, err)
	}
	fee := soap / 100
	if got := e.balance(sellerA); got != soap-fee {
		t.Fatalf("seller A wallet = %d, want %d (items less the 1%% fee)", got, soap-fee)
	}
	if e.holds(o.ID)[sellerA].State != domain.EscrowReleased || e.holds(o.ID)[sellerB].State != domain.EscrowFunded {
		t.Fatal("only seller A's escrow should have released")
	}
	// Sweeping again pays nothing twice.
	if n, _ := e.escrows.SweepAutoReleases(ctx); n != 0 || e.balance(sellerA) != soap-fee {
		t.Fatalf("second sweep paid again: released %d, balance %d", n, e.balance(sellerA))
	}

	// ── Seller B's goods never arrive: the buyer disputes, an admin refunds ──
	bHold := e.holds(o.ID)[sellerB]
	if _, err := e.escrows.Dispute(ctx, bHold.ID, buyerID, "never arrived"); err != nil {
		t.Fatalf("dispute: %v", err)
	}
	if _, err := e.escrows.Refund(ctx, bHold.ID, buyerID, false); err == nil {
		t.Fatal("the buyer refunded a disputed escrow without an admin")
	}
	if _, err := e.escrows.Resolve(ctx, bHold.ID, "refund"); err != nil {
		t.Fatalf("admin refund: %v", err)
	}
	if got := e.balance(buyerID); got != startFund-o.Total+butter {
		t.Fatalf("buyer wallet after refund = %d, want %d", got, startFund-o.Total+butter)
	}
	if e.balance(sellerB) != 0 {
		t.Fatal("seller B was paid for goods that never arrived")
	}

	// ── The audit agrees: every wallet's movement is on record ──
	all, err := audit.Wallets(ctx, e.db)
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range all {
		want := int64(0)
		if f.UserID == buyerID {
			want = startFund // the opening balance that was put there by hand, not by any recorded movement
		}
		if f.Difference != want {
			t.Errorf("audit: %s difference = %d, want %d (balance %d, expected %d)", f.UserID, f.Difference, want, f.Balance, f.Expected)
		}
	}
}

func TestBuyerConfirmsDeliveryAndPaysSellerEarly(t *testing.T) {
	e := setup(t, "orderflow_confirm")
	ctx := context.Background()
	o := e.placeOrder(t)
	h := e.holds(o.ID)[sellerB]

	if _, err := e.escrows.Release(ctx, h.ID, "someone-else", false); err == nil {
		t.Fatal("a stranger released the buyer's money")
	}
	if _, err := e.escrows.Release(ctx, h.ID, sellerB, false); err == nil {
		t.Fatal("the seller released their own payment")
	}
	if _, err := e.escrows.Release(ctx, h.ID, buyerID, false); err != nil {
		t.Fatalf("buyer confirm: %v", err)
	}
	if got, want := e.balance(sellerB), int64(1_200_000)-12_000; got != want {
		t.Fatalf("seller B wallet = %d, want %d", got, want)
	}
	if _, err := e.escrows.Release(ctx, h.ID, buyerID, false); err == nil {
		t.Fatal("the same escrow released twice")
	}
}

func TestSellerSeesOnlyTheirOwnPayout(t *testing.T) {
	e := setup(t, "orderflow_sellerview")
	o := e.placeOrder(t)

	sales, err := e.sellers.ListSales(context.Background(), sellerA)
	if err != nil || len(sales) != 1 {
		t.Fatalf("sales = %d, err %v", len(sales), err)
	}
	holds := sales[0].Holds
	if len(holds) != 1 || holds[0].Amount != 2*850_000 || holds[0].Net != 2*850_000-17_000 {
		t.Fatalf("seller A's holds = %+v, want only their own escrow with its net payout", holds)
	}
	if holds[0].Seller != "" {
		t.Error("a seller's view names a seller")
	}

	// The buyer sees both, each with the seller's name and no account ids.
	list, err := e.orders.ListMyOrders(context.Background(), buyerID)
	if err != nil || len(list) != 1 || list[0].ID != o.ID || len(list[0].Holds) != 2 {
		t.Fatalf("buyer's orders = %+v, err %v", list, err)
	}
	for _, h := range list[0].Holds {
		if h.Seller == "" {
			t.Errorf("hold %s has no seller name", h.ID)
		}
	}
}

// ── minimal repository stubs for the order service ──

type orderRepo struct{ db *gorm.DB }

func (r *orderRepo) CreateOrder(ctx context.Context, o *domain.Order) error {
	return r.db.Create(o).Error
}
func (r *orderRepo) GetOrderByID(ctx context.Context, id string) (*domain.Order, error) {
	var o domain.Order
	err := r.db.First(&o, "id = ?", id).Error
	return &o, err
}
func (r *orderRepo) ListOrdersByBuyer(ctx context.Context, buyerID string) ([]domain.Order, error) {
	var list []domain.Order
	err := r.db.Preload("Items").Where("buyer_id = ?", buyerID).Find(&list).Error
	return list, err
}
func (r *orderRepo) UpdatePaymentStatus(ctx context.Context, id, status string) error {
	return r.db.Model(&domain.Order{}).Where("id = ?", id).Update("payment_status", status).Error
}
func (r *orderRepo) UpdateShippingStatus(ctx context.Context, id, status string) error {
	return r.db.Model(&domain.Order{}).Where("id = ?", id).Update("shipping_status", status).Error
}

type productRepo struct{ db *gorm.DB }

func (r *productRepo) Create(ctx context.Context, p *domain.Product) error {
	return r.db.Create(p).Error
}
func (r *productRepo) GetByID(ctx context.Context, id uint) (*domain.Product, error) {
	var p domain.Product
	err := r.db.First(&p, id).Error
	return &p, err
}
func (r *productRepo) List(ctx context.Context, category, search string, limit, offset int) ([]domain.Product, error) {
	var list []domain.Product
	err := r.db.Limit(limit).Offset(offset).Find(&list).Error
	return list, err
}
func (r *productRepo) Update(ctx context.Context, p *domain.Product) error { return r.db.Save(p).Error }
func (r *productRepo) UpdateStock(ctx context.Context, id uint, change int) error {
	return r.db.Model(&domain.Product{}).Where("id = ?", id).Update("stock", gorm.Expr("stock + ?", change)).Error
}

func TestDeliveryFeeIsRecordedAgainstTheBuyer(t *testing.T) {
	e := setup(t, "orderflow_delivery_fee")
	cheap := domain.Product{SellerID: sellerA, Name: "Lip balm", Brand: "A", Price: 300_000, Category: "Body", Stock: 5}
	e.db.Create(&cheap)
	items := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{{cheap.ID, 1}}
	o, err := e.orders.CreateCheckout(context.Background(), buyerID, items, "1 Road", "Lagos", "Lagos", "0803", "wallet")
	if err != nil {
		t.Fatal(err)
	}
	if o.DeliveryFee != 150_000 || o.Total != 450_000 {
		t.Fatalf("fee=%d total=%d, want a ₦1,500 fee on a ₦3,000 order", o.DeliveryFee, o.Total)
	}
	var out int64
	e.db.Model(&domain.LedgerEntry{}).Where("from_account = ? AND type IN ?", buyerID, []string{"fund", "delivery"}).Select("COALESCE(SUM(amount), 0)").Scan(&out)
	if out != o.Total {
		t.Fatalf("ledger records %d leaving the buyer, want the full %d", out, o.Total)
	}
	// The seller's escrow holds only the goods; the fee stays with the platform.
	if h := e.holds(o.ID)[sellerA]; h.Amount != 300_000 {
		t.Fatalf("seller escrow = %d, want 300000 (goods only)", h.Amount)
	}
}

func TestDeliveryFeeReturnsOnlyWhenNothingWasDelivered(t *testing.T) {
	ctx := context.Background()

	// Two sellers, one paid and one refunded: the buyer received something, so the fee stays.
	e := setup(t, "orderflow_fee_partial")
	cheapA := domain.Product{SellerID: sellerA, Name: "Lip balm", Brand: "A", Price: 300_000, Category: "Body", Stock: 5}
	cheapB := domain.Product{SellerID: sellerB, Name: "Hair oil", Brand: "B", Price: 400_000, Category: "Body", Stock: 5}
	e.db.Create(&cheapA)
	e.db.Create(&cheapB)
	two := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{{cheapA.ID, 1}, {cheapB.ID, 1}}
	o, err := e.orders.CreateCheckout(ctx, buyerID, two, "1 Road", "Lagos", "Lagos", "0803", "wallet")
	if err != nil || o.DeliveryFee != 150_000 {
		t.Fatalf("checkout: fee=%d err=%v", o.DeliveryFee, err)
	}
	h := e.holds(o.ID)
	e.escrows.Release(ctx, h[sellerA].ID, buyerID, false)
	e.escrows.Dispute(ctx, h[sellerB].ID, buyerID, "never arrived")
	e.escrows.Resolve(ctx, h[sellerB].ID, "refund")
	if got, want := e.balance(buyerID), startFund-o.Total+400_000; got != want {
		t.Fatalf("partial: buyer wallet = %d, want %d (goods refunded, delivery fee kept)", got, want)
	}

	// One seller, refunded: nothing arrived, so the fee comes back too, exactly once.
	e2 := setup(t, "orderflow_fee_full")
	solo := domain.Product{SellerID: sellerA, Name: "Lip balm", Brand: "A", Price: 300_000, Category: "Body", Stock: 5}
	e2.db.Create(&solo)
	one := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{{solo.ID, 1}}
	o2, err := e2.orders.CreateCheckout(ctx, buyerID, one, "1 Road", "Lagos", "Lagos", "0803", "wallet")
	if err != nil {
		t.Fatal(err)
	}
	id := e2.holds(o2.ID)[sellerA].ID
	e2.escrows.Dispute(ctx, id, buyerID, "never arrived")
	if _, err := e2.escrows.Resolve(ctx, id, "refund"); err != nil {
		t.Fatal(err)
	}
	if got := e2.balance(buyerID); got != startFund {
		t.Fatalf("full refund: buyer wallet = %d, want the original %d back, delivery fee included", got, startFund)
	}
	if _, err := e2.escrows.Resolve(ctx, id, "refund"); err == nil {
		t.Fatal("the same escrow refunded twice")
	}
	if got := e2.balance(buyerID); got != startFund {
		t.Fatalf("a repeated refund changed the wallet to %d", got)
	}
	all, _ := audit.Wallets(ctx, e2.db)
	for _, f := range all {
		want := int64(0)
		if f.UserID == buyerID {
			want = startFund
		}
		if f.Difference != want {
			t.Errorf("audit: %s difference = %d, want %d", f.UserID, f.Difference, want)
		}
	}
}
