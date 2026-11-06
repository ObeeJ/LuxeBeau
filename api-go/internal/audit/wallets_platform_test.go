package audit

import (
	"context"
	"testing"

	"luxebeau/internal/domain"
)

// Releasing an escrow credits the platform wallet with the fee, but the ledger
// names that account "platform" while the wallet is keyed by a fixed id. The
// audit must connect the two, or it reports every platform fee as money with
// no record (it did, in the end-to-end run).
func TestWallets_PlatformFeeExplainsPlatformWallet(t *testing.T) {
	db := testDB(t)
	wallet(db, domain.PlatformWalletID, 8500)
	ledger(db, "fee", "escrow", "platform", 8500)

	all, err := Wallets(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	f := find(t, all, domain.PlatformWalletID)
	if f.Difference != 0 {
		t.Fatalf("platform wallet should be fully explained by its fees, got difference %d (expected %d)", f.Difference, f.Expected)
	}
}

// The platform wallet must still be audited: a balance beyond its fees is
// money with no record, exactly like any other wallet.
func TestWallets_PlatformWalletStillFlagsUnexplainedMoney(t *testing.T) {
	db := testDB(t)
	wallet(db, domain.PlatformWalletID, 9000)
	ledger(db, "fee", "escrow", "platform", 8500)

	all, err := Wallets(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	if f := find(t, all, domain.PlatformWalletID); f.Difference != 500 {
		t.Fatalf("expected 500 kobo unexplained, got %d", f.Difference)
	}
}
