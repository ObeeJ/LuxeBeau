package order

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func newSecurityDB(t *testing.T, name string) (*gorm.DB, domain.OrderService) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.Product{}, &domain.Order{}, &domain.OrderItem{}, &domain.Escrow{}, &domain.LedgerEntry{}, &domain.InfluencerReferral{}, &domain.InfluencerCommission{}, &domain.InfluencerPackage{}); err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return db, NewOrderService(&mockOrderRepo{db: db}, &mockProductRepo{db: db}, db, logger)
}

// seedOrder creates an order of one product from one seller whose price equals
// total, so its subtotal matches its items (an order with no items can't be held).
func seedOrder(t *testing.T, db *gorm.DB, id, buyer, status string, total int64) {
	t.Helper()
	p := domain.Product{SellerID: "seller-x", Name: "Item " + id, Brand: "B", Price: total, Category: "Body", Stock: 5}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	o := domain.Order{ID: id, BuyerID: buyer, Subtotal: total, Total: total, PaymentMethod: "card", PaymentStatus: status,
		Address: "1 Road", City: "Lagos", State: "Lagos", Phone: "0800",
		Items: []domain.OrderItem{{ProductID: p.ID, Qty: 1, Price: total}}}
	if err := db.Create(&o).Error; err != nil {
		t.Fatal(err)
	}
}

func paymentStatus(db *gorm.DB, id string) string {
	var o domain.Order
	db.Select("payment_status").First(&o, "id = ?", id)
	return o.PaymentStatus
}

func TestConfirmPayment(t *testing.T) {
	db, svc := newSecurityDB(t, "confirm_payment")
	ctx := context.Background()
	seedOrder(t, db, "LB-A", "buyer", "pending", 1500000)

	cases := []struct {
		name   string
		notice domain.PaymentNotice
		want   domain.PaymentOutcome
		status string
	}{
		{"unknown order", domain.PaymentNotice{Reference: "LB-NOPE", Succeeded: true, Amount: 1500000, Currency: "NGN"}, domain.PaymentUnknownOrder, "pending"},
		{"underpaid", domain.PaymentNotice{Reference: "LB-A", Succeeded: true, Amount: 100, Currency: "NGN"}, domain.PaymentAmountInvalid, "pending"},
		{"wrong currency", domain.PaymentNotice{Reference: "LB-A", Succeeded: true, Amount: 1500000, Currency: "USD"}, domain.PaymentAmountInvalid, "pending"},
		{"exact payment", domain.PaymentNotice{Reference: "LB-A", Succeeded: true, Amount: 1500000, Currency: "NGN"}, domain.PaymentMarkedPaid, "paid"},
		{"duplicate success", domain.PaymentNotice{Reference: "LB-A", Succeeded: true, Amount: 1500000, Currency: "ngn"}, domain.PaymentIgnored, "paid"},
		{"failure after payment", domain.PaymentNotice{Reference: "LB-A", Succeeded: false}, domain.PaymentIgnored, "paid"},
	}
	for _, c := range cases {
		got, err := svc.ConfirmPayment(ctx, c.notice)
		if err != nil || got != c.want {
			t.Errorf("%s: outcome=%s err=%v, want %s", c.name, got, err, c.want)
		}
		if s := paymentStatus(db, "LB-A"); s != c.status {
			t.Errorf("%s: order status=%s, want %s", c.name, s, c.status)
		}
	}

	// A failure on a pending order marks it failed; a later exact success still pays it.
	seedOrder(t, db, "LB-B", "buyer", "pending", 800000)
	if got, _ := svc.ConfirmPayment(ctx, domain.PaymentNotice{Reference: "LB-B", Succeeded: false}); got != domain.PaymentMarkedFailed {
		t.Errorf("failure on pending: %s", got)
	}
	if got, _ := svc.ConfirmPayment(ctx, domain.PaymentNotice{Reference: "LB-B", Succeeded: true, Amount: 800000, Currency: "NGN"}); got != domain.PaymentMarkedPaid {
		t.Errorf("retry success after failure: %s", got)
	}
}

func TestOrderIDsAreRandomAndWide(t *testing.T) {
	re := regexp.MustCompile(`^LB-[0-9A-F]{8}$`)
	seen := map[string]bool{}
	for i := 0; i < 2000; i++ {
		id, err := newOrderID()
		if err != nil || !re.MatchString(id) {
			t.Fatalf("order id %q err=%v", id, err)
		}
		if seen[id] {
			t.Fatalf("collision after %d ids", i)
		}
		seen[id] = true
	}
}

func TestGetOrder_OnlyBuyerOrAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, svc := newSecurityDB(t, "order_owner")
	seedOrder(t, db, "LB-OWN", "buyer-1", "paid", 1000)
	h := NewOrderHandler(svc, slog.New(slog.NewTextHandler(io.Discard, nil)))

	get := func(userID, role string) int {
		r := gin.New()
		r.GET("/orders/:id", func(c *gin.Context) {
			c.Set("userID", userID)
			c.Set("userRole", role)
			c.Next()
		}, h.GetOrder)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/orders/LB-OWN", bytes.NewReader(nil)))
		return w.Code
	}
	if code := get("buyer-1", "buyer"); code != http.StatusOK {
		t.Errorf("owner got %d", code)
	}
	if code := get("buyer-2", "buyer"); code != http.StatusNotFound {
		t.Errorf("another buyer got %d, want 404", code)
	}
	if code := get("seller-1", "seller"); code != http.StatusNotFound {
		t.Errorf("a seller got %d, want 404", code)
	}
	if code := get("admin-1", "admin"); code != http.StatusOK {
		t.Errorf("admin got %d", code)
	}
}

func countRows(db *gorm.DB, model any, where string, args ...any) int64 {
	var n int64
	db.Model(model).Where(where, args...).Count(&n)
	return n
}

func TestConfirmPayment_HoldsMoneyOnceFromGateway(t *testing.T) {
	db, svc := newSecurityDB(t, "confirm_holds")
	ctx := context.Background()
	seedOrder(t, db, "LB-G", "buyer", "pending", 1500000)
	db.Create(&domain.Wallet{UserID: "buyer", Balance: 777})

	notice := domain.PaymentNotice{Provider: "paystack", Reference: "LB-G", Succeeded: true, Amount: 1500000, Currency: "NGN"}
	if got, err := svc.ConfirmPayment(ctx, notice); err != nil || got != domain.PaymentMarkedPaid {
		t.Fatalf("first notice: %s, %v", got, err)
	}
	if n := countRows(db, &domain.Escrow{}, "kind = ? AND reference = ? AND state = ? AND amount = ?", domain.EscrowKindOrder, "LB-G", domain.EscrowFunded, 1500000); n != 1 {
		t.Fatalf("held escrows = %d, want 1", n)
	}
	// Card money never touches the wallet, and the ledger says it came from the gateway.
	var w domain.Wallet
	db.First(&w, "user_id = ?", "buyer")
	if w.Balance != 777 {
		t.Errorf("a card payment changed the wallet: %d", w.Balance)
	}
	if n := countRows(db, &domain.LedgerEntry{}, "type = ? AND from_account = ?", "fund", "gateway"); n != 1 {
		t.Errorf("gateway ledger entries = %d, want 1", n)
	}

	// The provider retries: nothing more is held.
	if got, _ := svc.ConfirmPayment(ctx, notice); got != domain.PaymentIgnored {
		t.Errorf("duplicate notice: %s", got)
	}
	if n := countRows(db, &domain.Escrow{}, "reference = ?", "LB-G"); n != 1 {
		t.Errorf("escrows after duplicate = %d, want 1", n)
	}
	if n := countRows(db, &domain.LedgerEntry{}, "1 = 1"); n != 1 {
		t.Errorf("ledger entries after duplicate = %d, want 1", n)
	}
}

func TestConfirmPayment_FailedHoldLeavesOrderUnpaid(t *testing.T) {
	db, svc := newSecurityDB(t, "confirm_hold_fails")
	ctx := context.Background()
	seedOrder(t, db, "LB-X", "buyer", "pending", 900000)
	// A product with no seller can't be paid out, so the money can't be held.
	db.Model(&domain.Product{}).Where("1 = 1").Update("seller_id", "")

	got, err := svc.ConfirmPayment(ctx, domain.PaymentNotice{Reference: "LB-X", Succeeded: true, Amount: 900000, Currency: "NGN"})
	if err == nil {
		t.Fatalf("confirm succeeded (%s) though the money could not be held", got)
	}
	if s := paymentStatus(db, "LB-X"); s != "pending" {
		t.Errorf("order is %q after a failed hold, want pending so the provider's retry can complete it", s)
	}
	if n := countRows(db, &domain.Escrow{}, "reference = ?", "LB-X"); n != 0 {
		t.Errorf("%d escrows left behind", n)
	}
}
