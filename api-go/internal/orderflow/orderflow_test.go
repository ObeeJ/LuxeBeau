// Package orderflow tests the whole life of an order's money across packages:
// checkout, escrow, per-seller delivery, the platform fee, the buyer's window,
// auto-release, dispute and refund, and checks both audits agree with every step.
//
// The money model these tests describe:
//   - the buyer pays the platform fee (3.5% / 3% / 2.5% of the item subtotal,
//     by tier) on top of the price, plus the gateway's processing fee on card
//     payments;
//   - each seller's escrow holds their items plus their own delivery fee, and
//     is paid out in full, with nothing taken from it;
//   - the platform fee is platform income from the moment payment succeeds, and
//     goes back to the buyer only if the whole order is refunded.
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

	// No zones configured: each seller falls back to the platform default.
	defaultDelivery = int64(150_000) // ₦1,500
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
	if err := db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.Product{}, &domain.Order{}, &domain.OrderItem{}, &domain.Escrow{}, &domain.LedgerEntry{}, &domain.Artisan{}, &domain.DeliveryZone{}); err != nil {
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
	db.Create(&domain.Wallet{UserID: domain.PlatformWalletID})
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

// ledgerSum adds up ledger rows of one type, optionally from one account.
func (e *env) ledgerSum(typ, from string) int64 {
	q := e.db.Model(&domain.LedgerEntry{}).Where("type = ?", typ)
	if from != "" {
		q = q.Where("from_account = ?", from)
	}
	var n int64
	q.Select("COALESCE(SUM(amount), 0)").Scan(&n)
	return n
}

type line struct {
	id  uint
	qty int
}

func (e *env) checkout(t *testing.T, method string, lines ...line) *domain.Order {
	t.Helper()
	items := make([]struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}, len(lines))
	for i, l := range lines {
		items[i].ProductID, items[i].Qty = l.id, l.qty
	}
	o, err := e.orders.CreateCheckout(context.Background(), buyerID, items, "12 Admiralty Way", "Lagos", "Lagos", "08030000001", method)
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	return o
}

// placeOrder buys 2 of seller A's soap and 1 of seller B's butter from the wallet.
// Items ₦29,000 (3% tier, fee ₦870), delivery ₦1,500 from each seller, total ₦32,870.
func (e *env) placeOrder(t *testing.T) *domain.Order {
	t.Helper()
	return e.checkout(t, "wallet", line{e.prodA.ID, 2}, line{e.prodB.ID, 1})
}

func (e *env) product(seller string, price int64) domain.Product {
	p := domain.Product{SellerID: seller, Name: "Item", Brand: "X", Price: price, Category: "Body", Stock: 50}
	e.db.Create(&p)
	return p
}

// everyWalletReconciles fails if any wallet holds money its history does not
// explain. The buyer's opening balance was put there by hand, so it is the one
// expected difference.
func (e *env) everyWalletReconciles(t *testing.T) {
	t.Helper()
	all, err := audit.Wallets(context.Background(), e.db)
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range all {
		want := int64(0)
		if f.UserID == buyerID {
			want = startFund
		}
		if f.Difference != want {
			t.Errorf("wallet audit: %s difference = %d, want %d (balance %d, expected %d)", f.UserID, f.Difference, want, f.Balance, f.Expected)
		}
	}
	escrows, err := audit.Escrows(context.Background(), e.db)
	if err != nil {
		t.Fatal(err)
	}
	if bad := audit.Broken(escrows); len(bad) != 0 {
		t.Errorf("escrow audit found %+v", bad)
	}
}

func TestOrderMoneyLifecycle(t *testing.T) {
	e := setup(t, "orderflow_lifecycle")
	ctx := context.Background()

	// ── Checkout: the buyer pays goods + each seller's delivery + the platform fee ──
	o := e.placeOrder(t)
	soap, butter := int64(2*850_000), int64(1_200_000)
	if o.Subtotal != soap+butter {
		t.Fatalf("subtotal = %d, want %d", o.Subtotal, soap+butter)
	}
	if o.DeliveryFee != 2*defaultDelivery || o.PlatformFee != 87_000 || o.ProcessingFee != 0 {
		t.Fatalf("delivery=%d platform=%d processing=%d, want 300000 / 87000 / 0 (wallet pays no processing fee)", o.DeliveryFee, o.PlatformFee, o.ProcessingFee)
	}
	if o.Total != 3_287_000 {
		t.Fatalf("total = %d, want 3287000", o.Total)
	}
	if got := e.balance(buyerID); got != startFund-o.Total {
		t.Fatalf("buyer balance = %d, want %d (debited exactly the order total)", got, startFund-o.Total)
	}
	holds := e.holds(o.ID)
	wantA, wantB := soap+defaultDelivery, butter+defaultDelivery
	if len(holds) != 2 || holds[sellerA].Amount != wantA || holds[sellerB].Amount != wantB {
		t.Fatalf("holds = %+v, want one escrow per seller worth %d and %d (goods + their own delivery)", holds, wantA, wantB)
	}
	for id, h := range holds {
		if h.State != domain.EscrowFunded || h.SettlementRail != domain.RailHeld || h.ReleaseEligibleAt != nil {
			t.Errorf("hold for %s: state=%s rail=%s release=%v; want funded, held rail, no release time yet", id, h.State, h.SettlementRail, h.ReleaseEligibleAt)
		}
		if h.FeeBps != 0 {
			t.Errorf("hold for %s takes %d bps from the seller; the buyer pays the fee, so it must be 0", id, h.FeeBps)
		}
	}
	if e.balance(sellerA) != 0 || e.balance(sellerB) != 0 {
		t.Fatal("a seller was paid before delivery")
	}
	if got := e.balance(domain.PlatformWalletID); got != 87_000 {
		t.Fatalf("platform wallet = %d, want the 87000 fee as soon as the order is paid", got)
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
	if n, err := e.escrows.SweepAutoReleases(ctx); err != nil || n != 0 {
		t.Fatalf("sweep inside the window: released %d, err %v; want 0", n, err)
	}
	before := *a
	e.sellers.Fulfil(ctx, sellerA, o.ID, "delivered", "again")
	if again := e.holds(o.ID)[sellerA].ReleaseEligibleAt; !again.Equal(before) {
		t.Errorf("window moved from %v to %v", before, again)
	}

	// ── The window passes: seller A is paid in full, nothing taken out ──
	e.db.Model(&domain.Escrow{}).Where("id = ?", holds[sellerA].ID).Update("release_eligible_at", time.Now().Add(-time.Minute))
	if n, err := e.escrows.SweepAutoReleases(ctx); err != nil || n != 1 {
		t.Fatalf("sweep after the window: released %d, err %v; want 1", n, err)
	}
	if got := e.balance(sellerA); got != wantA {
		t.Fatalf("seller A wallet = %d, want %d (goods and delivery, no fee taken)", got, wantA)
	}
	if e.holds(o.ID)[sellerA].State != domain.EscrowReleased || e.holds(o.ID)[sellerB].State != domain.EscrowFunded {
		t.Fatal("only seller A's escrow should have released")
	}
	if n, _ := e.escrows.SweepAutoReleases(ctx); n != 0 || e.balance(sellerA) != wantA {
		t.Fatalf("second sweep paid again: released %d, balance %d", n, e.balance(sellerA))
	}
	if got := e.balance(domain.PlatformWalletID); got != 87_000 {
		t.Fatalf("platform wallet = %d after a release, want it unchanged at 87000", got)
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
	if got, want := e.balance(buyerID), startFund-o.Total+wantB; got != want {
		t.Fatalf("buyer wallet after refund = %d, want %d (B's goods and delivery back)", got, want)
	}
	if e.balance(sellerB) != 0 {
		t.Fatal("seller B was paid for goods that never arrived")
	}
	if got := e.balance(domain.PlatformWalletID); got != 87_000 {
		t.Fatalf("platform wallet = %d, want the fee kept because seller A delivered", got)
	}

	e.everyWalletReconciles(t)
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
	if got, want := e.balance(sellerB), int64(1_200_000)+defaultDelivery; got != want {
		t.Fatalf("seller B wallet = %d, want %d (full price and delivery)", got, want)
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
	want := int64(2*850_000) + defaultDelivery
	if len(holds) != 1 || holds[0].Amount != want || holds[0].Net != want {
		t.Fatalf("seller A's holds = %+v, want only their own escrow, paid out in full (%d)", holds, want)
	}
	if holds[0].Seller != "" {
		t.Error("a seller's view names a seller")
	}

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

func TestBuyerPaysThePlatformFeeAndSellerKeepsTheirDelivery(t *testing.T) {
	e := setup(t, "orderflow_fee_on_top")
	cheap := e.product(sellerA, 300_000) // ₦3,000: lowest tier, 3.5%
	o := e.checkout(t, "wallet", line{cheap.ID, 1})

	if o.PlatformFee != 10_500 || o.DeliveryFee != defaultDelivery || o.Total != 300_000+defaultDelivery+10_500 {
		t.Fatalf("platform=%d delivery=%d total=%d, want 10500 / 150000 / 460500", o.PlatformFee, o.DeliveryFee, o.Total)
	}
	// The seller's escrow is the goods plus their delivery; the fee is not in it.
	if h := e.holds(o.ID)[sellerA]; h.Amount != 450_000 {
		t.Fatalf("seller escrow = %d, want 450000 (goods + delivery, no fee)", h.Amount)
	}
	// The ledger accounts for every kobo that left the buyer: goods, delivery and fee.
	if out := e.ledgerSum("fund", buyerID) + e.ledgerSum("fee", buyerID); out != o.Total {
		t.Fatalf("ledger shows %d leaving the buyer, want the full %d", out, o.Total)
	}
	if got := e.ledgerSum("delivery", ""); got != 0 {
		t.Errorf("a separate delivery row of %d means delivery is still going to the platform", got)
	}
	e.everyWalletReconciles(t)
}

func TestSellersSetTheirOwnDeliveryFee(t *testing.T) {
	e := setup(t, "orderflow_zones")
	ctx := context.Background()
	if err := e.sellers.UpsertDeliveryZones(ctx, sellerA, []domain.DeliveryZone{{City: "Lagos", FeeKobo: 80_000}}); err != nil {
		t.Fatal(err)
	}
	a := e.product(sellerA, 300_000)
	b := e.product(sellerB, 400_000) // seller B set no zones: platform default

	o := e.checkout(t, "wallet", line{a.ID, 1}, line{b.ID, 1})
	if o.DeliveryFee != 80_000+defaultDelivery {
		t.Fatalf("delivery = %d, want seller A's 80000 plus seller B's default 150000", o.DeliveryFee)
	}
	holds := e.holds(o.ID)
	if holds[sellerA].Amount != 300_000+80_000 || holds[sellerB].Amount != 400_000+defaultDelivery {
		t.Fatalf("holds = A %d, B %d; each seller's escrow must carry their own delivery fee", holds[sellerA].Amount, holds[sellerB].Amount)
	}
	// A seller whose zone is free ships free.
	if err := e.sellers.UpsertDeliveryZones(ctx, sellerB, []domain.DeliveryZone{{City: "", FeeKobo: 0}}); err != nil {
		t.Fatal(err)
	}
	o2 := e.checkout(t, "wallet", line{b.ID, 1})
	if o2.DeliveryFee != 0 {
		t.Fatalf("delivery = %d, want 0 for a seller who ships free", o2.DeliveryFee)
	}
	e.everyWalletReconciles(t)
}

func TestPlatformFeeTiersAtCheckout(t *testing.T) {
	e := setup(t, "orderflow_tiers")
	// Four orders including a ₦60,000 one: more than the usual test balance.
	e.db.Model(&domain.Wallet{}).Where("user_id = ?", buyerID).Update("balance", 100_000_000)
	cases := []struct {
		price, fee int64
	}{
		{1_000_000, 35_000},  // ₦10,000 exactly: 3.5%
		{1_200_000, 36_000},  // ₦12,000: 3% of the whole order
		{5_000_000, 150_000}, // ₦50,000 exactly: 3%
		{6_000_000, 150_000}, // ₦60,000: 2.5% of the whole order
	}
	for _, c := range cases {
		p := e.product(sellerA, c.price)
		o := e.checkout(t, "wallet", line{p.ID, 1})
		if o.PlatformFee != c.fee {
			t.Errorf("order of %d kobo: platform fee = %d, want %d", c.price, o.PlatformFee, c.fee)
		}
		if o.Subtotal != c.price || o.Total != c.price+defaultDelivery+c.fee {
			t.Errorf("order of %d kobo: subtotal=%d total=%d", c.price, o.Subtotal, o.Total)
		}
	}
}

func TestPlatformFeeReturnsOnlyWhenTheWholeOrderIsRefunded(t *testing.T) {
	ctx := context.Background()

	// Two sellers, one paid and one refunded: the buyer received something, so
	// the platform fee stays (and so does the platform's income).
	e := setup(t, "orderflow_fee_partial")
	cheapA := e.product(sellerA, 300_000)
	cheapB := e.product(sellerB, 400_000)
	o := e.checkout(t, "wallet", line{cheapA.ID, 1}, line{cheapB.ID, 1})
	if o.PlatformFee != 24_500 || o.Total != 700_000+2*defaultDelivery+24_500 {
		t.Fatalf("platform=%d total=%d, want 24500 / 1024500", o.PlatformFee, o.Total)
	}
	h := e.holds(o.ID)
	e.escrows.Release(ctx, h[sellerA].ID, buyerID, false)
	e.escrows.Dispute(ctx, h[sellerB].ID, buyerID, "never arrived")
	e.escrows.Resolve(ctx, h[sellerB].ID, "refund")
	if got, want := e.balance(buyerID), startFund-o.Total+(400_000+defaultDelivery); got != want {
		t.Fatalf("partial: buyer wallet = %d, want %d (B's goods and delivery refunded, platform fee kept)", got, want)
	}
	if got := e.balance(domain.PlatformWalletID); got != 24_500 {
		t.Fatalf("partial: platform wallet = %d, want the fee kept (24500)", got)
	}
	e.everyWalletReconciles(t)

	// One seller, refunded: nothing arrived, so everything comes back, the
	// platform fee included, exactly once.
	e2 := setup(t, "orderflow_fee_full")
	solo := e2.product(sellerA, 300_000)
	o2 := e2.checkout(t, "wallet", line{solo.ID, 1})
	id := e2.holds(o2.ID)[sellerA].ID
	e2.escrows.Dispute(ctx, id, buyerID, "never arrived")
	if _, err := e2.escrows.Resolve(ctx, id, "refund"); err != nil {
		t.Fatal(err)
	}
	if got := e2.balance(buyerID); got != startFund {
		t.Fatalf("full refund: buyer wallet = %d, want the original %d back, platform fee included", got, startFund)
	}
	if got := e2.balance(domain.PlatformWalletID); got != 0 {
		t.Fatalf("full refund: platform wallet = %d, want 0 (the fee was given back)", got)
	}
	if _, err := e2.escrows.Resolve(ctx, id, "refund"); err == nil {
		t.Fatal("the same escrow refunded twice")
	}
	if got := e2.balance(buyerID); got != startFund {
		t.Fatalf("a repeated refund changed the wallet to %d", got)
	}
	e2.everyWalletReconciles(t)
}

func TestCardPaymentAddsTheProcessingFeeAndEverythingBalances(t *testing.T) {
	e := setup(t, "orderflow_card")
	ctx := context.Background()
	a := e.product(sellerA, 300_000)
	b := e.product(sellerB, 400_000)

	o := e.checkout(t, "card", line{a.ID, 1}, line{b.ID, 1})
	base := int64(700_000 + 2*defaultDelivery + 24_500)
	if o.PaymentStatus != "pending" {
		t.Fatalf("a card order is paid only when the gateway says so, status = %s", o.PaymentStatus)
	}
	if o.ProcessingFee <= 0 || o.Total != base+o.ProcessingFee {
		t.Fatalf("processing=%d total=%d, want the buyer to carry the gateway's fee on top of %d", o.ProcessingFee, o.Total, base)
	}
	if o.PlatformFee != 24_500 || o.DeliveryFee != 2*defaultDelivery {
		t.Fatalf("platform=%d delivery=%d", o.PlatformFee, o.DeliveryFee)
	}
	if len(e.holds(o.ID)) != 0 || e.balance(domain.PlatformWalletID) != 0 {
		t.Fatal("money was held or credited before the payment arrived")
	}

	// A charge that leaves out the processing fee is not the amount we asked for.
	out, err := e.orders.ConfirmPayment(ctx, domain.PaymentNotice{Provider: "paystack", Reference: o.ID, Succeeded: true, Amount: base, Currency: "NGN"})
	if err != nil || out != domain.PaymentAmountInvalid {
		t.Fatalf("short payment: outcome %q err %v, want amount_invalid", out, err)
	}

	out, err = e.orders.ConfirmPayment(ctx, domain.PaymentNotice{Provider: "paystack", Reference: o.ID, Succeeded: true, Amount: o.Total, Currency: "NGN"})
	if err != nil || out != domain.PaymentMarkedPaid {
		t.Fatalf("payment: outcome %q err %v, want paid", out, err)
	}
	holds := e.holds(o.ID)
	if holds[sellerA].Amount != 300_000+defaultDelivery || holds[sellerB].Amount != 400_000+defaultDelivery {
		t.Fatalf("holds = A %d, B %d; processing and platform fees must not be in the sellers' money", holds[sellerA].Amount, holds[sellerB].Amount)
	}
	if got := e.balance(domain.PlatformWalletID); got != 24_500 {
		t.Fatalf("platform wallet = %d, want the 24500 platform fee (not the processing fee)", got)
	}
	// Every kobo the gateway collected is on the ledger, from the gateway.
	var fromGateway int64
	for _, typ := range []string{"fund", "fee", "processing"} {
		fromGateway += e.ledgerSum(typ, escrow.GatewayAccount)
	}
	if fromGateway != o.Total {
		t.Fatalf("ledger shows %d from the gateway, want the full %d", fromGateway, o.Total)
	}
	if got := e.ledgerSum("processing", escrow.GatewayAccount); got != o.ProcessingFee {
		t.Fatalf("processing row = %d, want %d", got, o.ProcessingFee)
	}
	// A repeated notice changes nothing.
	out, _ = e.orders.ConfirmPayment(ctx, domain.PaymentNotice{Provider: "paystack", Reference: o.ID, Succeeded: true, Amount: o.Total, Currency: "NGN"})
	if out != domain.PaymentIgnored || e.balance(domain.PlatformWalletID) != 24_500 || len(e.holds(o.ID)) != 2 {
		t.Fatalf("a repeated notice: outcome %q, platform %d, holds %d", out, e.balance(domain.PlatformWalletID), len(e.holds(o.ID)))
	}
	if got := e.balance(buyerID); got != startFund {
		t.Fatalf("a card order touched the buyer's wallet: %d", got)
	}
	e.everyWalletReconciles(t)
}

// What the buyer is shown before paying must be what checkout then charges,
// for every payment method, including the seller's own delivery fee.
func TestQuoteMatchesWhatCheckoutCharges(t *testing.T) {
	e := setup(t, "orderflow_quote")
	ctx := context.Background()
	if err := e.sellers.UpsertDeliveryZones(ctx, sellerA, []domain.DeliveryZone{{City: "Lagos", FeeKobo: 80_000}}); err != nil {
		t.Fatal(err)
	}
	a := e.product(sellerA, 300_000)
	b := e.product(sellerB, 400_000)
	items := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{{a.ID, 1}, {b.ID, 2}}

	for _, method := range []string{"wallet", "card"} {
		q, err := e.orders.QuoteCheckout(ctx, items, "Lagos", method)
		if err != nil {
			t.Fatalf("%s quote: %v", method, err)
		}
		o, err := e.orders.CreateCheckout(ctx, buyerID, items, "1 Road", "Lagos", "Lagos", "0803", method)
		if err != nil {
			t.Fatalf("%s checkout: %v", method, err)
		}
		if q.Subtotal != o.Subtotal || q.DeliveryFee != o.DeliveryFee || q.PlatformFee != o.PlatformFee ||
			q.ProcessingFee != o.ProcessingFee || q.Total != o.Total {
			t.Errorf("%s: quote %+v but checkout charged subtotal=%d delivery=%d platform=%d processing=%d total=%d",
				method, *q, o.Subtotal, o.DeliveryFee, o.PlatformFee, o.ProcessingFee, o.Total)
		}
	}
	// Seller A's own 800 + seller B's default 1,500, on goods of 3,000 + 2 x 4,000.
	q, _ := e.orders.QuoteCheckout(ctx, items, "Lagos", "wallet")
	if q.DeliveryFee != 80_000+defaultDelivery || q.Subtotal != 1_100_000 {
		t.Errorf("quote = %+v, want delivery 230000 and goods 1100000", *q)
	}
}

func TestQuoteChangesNothing(t *testing.T) {
	e := setup(t, "orderflow_quote_readonly")
	p := e.product(sellerA, 300_000)
	items := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{{p.ID, 3}}
	if _, err := e.orders.QuoteCheckout(context.Background(), items, "Lagos", "wallet"); err != nil {
		t.Fatal(err)
	}
	var stock int
	e.db.Model(&domain.Product{}).Where("id = ?", p.ID).Select("stock").Scan(&stock)
	var orders, entries int64
	e.db.Model(&domain.Order{}).Count(&orders)
	e.db.Model(&domain.LedgerEntry{}).Count(&entries)
	if stock != 50 || orders != 0 || entries != 0 || e.balance(buyerID) != startFund {
		t.Fatalf("a quote must change nothing: stock=%d orders=%d ledger=%d buyer=%d", stock, orders, entries, e.balance(buyerID))
	}
	if _, err := e.orders.QuoteCheckout(context.Background(), []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{{p.ID, 0}}, "Lagos", "wallet"); err == nil {
		t.Error("a quantity of 0 must be rejected, as at checkout")
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
