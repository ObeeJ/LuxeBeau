package audit

import (
	"context"
	"testing"
)

// A withdrawal takes money out of a wallet and a reversal puts it back. Both are
// on the ledger, so the wallet still reconciles after either.
func TestWallets_WithdrawalsAndReversalsReconcile(t *testing.T) {
	db := testDB(t)
	// The seller earned N10,000, withdrew N4,000 (still in flight), and a second
	// N3,000 withdrawal failed and came back: 10,000 - 4,000 - 3,000 + 3,000.
	wallet(db, "seller-1", 600_000)
	ledger(db, "release", "escrow", "seller-1", 1_000_000)
	ledger(db, "withdrawal", "seller-1", "bank", 400_000)
	ledger(db, "withdrawal", "seller-1", "bank", 300_000)
	ledger(db, "withdrawal_reversal", "bank", "seller-1", 300_000)

	all, err := Wallets(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	if f := find(t, all, "seller-1"); f.Difference != 0 {
		t.Errorf("seller should reconcile through a withdrawal and a reversal, difference %d (balance %d, expected %d)", f.Difference, f.Balance, f.Expected)
	}
}
