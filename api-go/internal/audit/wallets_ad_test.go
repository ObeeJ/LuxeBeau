package audit

import (
	"context"
	"testing"

	"luxebeau/internal/domain"
)

// Paying for an ad moves money from the seller's wallet to the platform wallet
// and writes a ledger row of type "ad". Both wallets must still reconcile, or
// every paid ad shows up as missing or unexplained money.
func TestWallets_AdPaymentReconcilesBothWallets(t *testing.T) {
	db := testDB(t)
	// The seller earned N10,000 from a sale and spent N5,000 on an ad.
	wallet(db, "seller-1", 500000)
	ledger(db, "release", "escrow", "seller-1", 1000000)
	ledger(db, "ad", "seller-1", "platform", 500000)
	// The platform's wallet holds what the ad paid.
	wallet(db, domain.PlatformWalletID, 500000)

	all, err := Wallets(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	if f := find(t, all, "seller-1"); f.Difference != 0 {
		t.Errorf("seller should reconcile after paying for an ad, difference %d", f.Difference)
	}
	if f := find(t, all, domain.PlatformWalletID); f.Difference != 0 {
		t.Errorf("platform should reconcile after receiving ad income, difference %d", f.Difference)
	}
}

// An ad paid through the gateway never touches a user wallet; only the
// platform wallet gains.
func TestWallets_GatewayPaidAdOnlyCreditsPlatform(t *testing.T) {
	db := testDB(t)
	ledger(db, "ad", "gateway", "platform", 500000)
	wallet(db, domain.PlatformWalletID, 500000)

	all, err := Wallets(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	if f := find(t, all, domain.PlatformWalletID); f.Difference != 0 {
		t.Errorf("platform should reconcile, difference %d", f.Difference)
	}
}
