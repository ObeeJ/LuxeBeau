package audit

import (
	"context"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:wallet_audit?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.Order{}, &domain.Escrow{}, &domain.LedgerEntry{}); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"wallets", "users", "orders", "escrows", "ledger_entries"} {
		db.Exec("DELETE FROM " + table)
	}
	return db
}

func user(db *gorm.DB, id string) {
	db.Create(&domain.User{ID: id, Name: id, Email: id + "@test.ng"})
}

func wallet(db *gorm.DB, id string, balance int64) {
	db.Create(&domain.Wallet{UserID: id, Balance: balance})
}

func ledger(db *gorm.DB, typ, from, to string, amount int64) {
	db.Create(&domain.LedgerEntry{EscrowID: "ESC-1", Type: typ, FromAccount: from, ToAccount: to, Amount: amount})
}

func find(t *testing.T, all []WalletFinding, id string) WalletFinding {
	t.Helper()
	for _, f := range all {
		if f.UserID == id {
			return f
		}
	}
	t.Fatalf("no finding for %s", id)
	return WalletFinding{}
}

func TestWallets_ExplainsBalancesFromHistory(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()

	// seller: earned 9,900 from two releases, nothing else. Balanced.
	user(db, "seller")
	wallet(db, "seller", 990000)
	ledger(db, "release", "escrow", "seller", 495000)
	ledger(db, "release", "escrow", "seller", 495000)
	ledger(db, "fee", "escrow", "platform", 10000) // platform fee isn't the seller's money

	// buyer: refunded 4,000, then funded a new escrow of 1,500 from the wallet. Balanced at 2,500.
	user(db, "buyer")
	wallet(db, "buyer", 250000)
	ledger(db, "refund", "escrow", "buyer", 400000)
	ledger(db, "fund", "buyer", "escrow", 100000)
	ledger(db, "delivery", "buyer", "platform", 50000)

	// cheat: gave themselves ₦5,000,000 (the old /wallets/credit), nothing on record.
	user(db, "cheat")
	wallet(db, "cheat", 500000000)

	// legacy: paid an order from the wallet before orders used escrow: -2,000.
	// With no income on record, expected is -2,000, so a 0 balance is ₦2,000 unexplained.
	user(db, "legacy")
	wallet(db, "legacy", 0)
	db.Create(&domain.Order{ID: "LB-OLD", BuyerID: "legacy", Total: 200000, PaymentMethod: "wallet", PaymentStatus: "paid", Address: "x", City: "x", State: "x", Phone: "1"})

	// escrowed: paid an order from the wallet that has an escrow. The ledger
	// carries the outflow, so the order must not be counted a second time.
	user(db, "escrowed")
	wallet(db, "escrowed", 100000)
	db.Create(&domain.Order{ID: "LB-NEW", BuyerID: "escrowed", Total: 300000, PaymentMethod: "wallet", PaymentStatus: "paid", Address: "x", City: "x", State: "x", Phone: "1"})
	db.Create(&domain.Escrow{ID: "ESC-9", Kind: domain.EscrowKindOrder, Reference: "LB-NEW", BuyerID: "escrowed", PayeeID: "seller", Amount: 250000})
	ledger(db, "refund", "escrow", "escrowed", 400000)
	ledger(db, "fund", "escrowed", "escrow", 250000)
	ledger(db, "delivery", "escrowed", "platform", 50000)

	// card: an order paid by card (ledger "from" is the gateway, not the user)
	// did not touch the wallet, so it must not reduce what's expected.
	user(db, "card")
	wallet(db, "card", 0)
	ledger(db, "fund", "gateway", "escrow", 800000)

	all, err := Wallets(ctx, db)
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		id         string
		wantExpect int64
		wantDiff   int64
	}{
		{"seller", 990000, 0},
		{"buyer", 250000, 0},
		{"cheat", 0, 500000000},
		{"legacy", -200000, 200000},
		{"escrowed", 100000, 0},
		{"card", 0, 0},
	}
	for _, c := range cases {
		f := find(t, all, c.id)
		if f.Expected != c.wantExpect || f.Difference != c.wantDiff {
			t.Errorf("%s: expected=%d difference=%d, want %d and %d", c.id, f.Expected, f.Difference, c.wantExpect, c.wantDiff)
		}
	}
	if find(t, all, "cheat").Email != "cheat@test.ng" {
		t.Error("finding is missing the user's email")
	}
	if all[0].UserID != "cheat" {
		t.Errorf("largest difference should be listed first, got %s", all[0].UserID)
	}

	listed := Unexplained(all)
	if len(listed) != 2 {
		t.Fatalf("unexplained wallets = %d, want 2 (cheat and legacy)", len(listed))
	}
}

func TestWallets_ReadOnly(t *testing.T) {
	db := testDB(t)
	user(db, "u")
	wallet(db, "u", 100)
	if _, err := Wallets(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	var w domain.Wallet
	db.First(&w, "user_id = ?", "u")
	if w.Balance != 100 {
		t.Fatalf("the audit changed a balance: %d", w.Balance)
	}
}
