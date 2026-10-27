// Package audit holds read-only checks that compare stored balances with the
// records that should explain them.
package audit

import (
	"context"
	"sort"

	"gorm.io/gorm"
)

// WalletFinding compares one wallet's balance with what its history explains.
//
// Money enters a wallet only when an escrow is released or refunded to its
// owner, and leaves it when the owner funds an escrow or pays an order from
// the wallet. (The old POST /wallets/credit endpoint added money with no
// record at all, which is what this audit exists to find.)
//
//	expected = escrow money in - escrow money out - wallet-paid orders with no escrow
type WalletFinding struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	// Balance is what the wallet holds now, in kobo.
	Balance int64 `json:"balance"`
	// Expected is what the records explain, in kobo.
	Expected int64 `json:"expected"`
	// Difference = Balance - Expected. Positive means money with no record.
	Difference int64 `json:"difference"`

	EscrowIn     int64 `json:"escrow_in"`     // released or refunded to this user
	EscrowOut    int64 `json:"escrow_out"`    // funded by this user from the wallet
	LegacyOrders int64 `json:"legacy_orders"` // wallet-paid orders placed before orders used escrow
}

type walletRow struct {
	UserID       string
	Email        string
	Balance      int64
	EscrowIn     int64
	EscrowOut    int64
	LegacyOrders int64
}

// walletSQL joins each wallet to its three explanations. Ids are compared as
// text because wallets and orders store them as uuid while the ledger stores
// them as plain strings ("escrow" and "platform" also appear there).
const walletSQL = `
SELECT w.user_id AS user_id,
       COALESCE(u.email, '') AS email,
       w.balance AS balance,
       COALESCE(i.total, 0) AS escrow_in,
       COALESCE(o.total, 0) AS escrow_out,
       COALESCE(l.total, 0) AS legacy_orders
FROM wallets w
LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(w.user_id AS TEXT)
LEFT JOIN (
    SELECT to_account AS acct, CAST(SUM(amount) AS BIGINT) AS total
    FROM ledger_entries WHERE type IN ('release', 'refund') GROUP BY to_account
) i ON i.acct = CAST(w.user_id AS TEXT)
LEFT JOIN (
    SELECT from_account AS acct, CAST(SUM(amount) AS BIGINT) AS total
    FROM ledger_entries WHERE type IN ('fund', 'delivery') GROUP BY from_account
) o ON o.acct = CAST(w.user_id AS TEXT)
LEFT JOIN (
    SELECT CAST(buyer_id AS TEXT) AS acct, CAST(SUM(total) AS BIGINT) AS total
    FROM orders
    WHERE payment_method = 'wallet' AND payment_status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM escrows e WHERE e.kind = 'order' AND e.reference = orders.id)
    GROUP BY CAST(buyer_id AS TEXT)
) l ON l.acct = CAST(w.user_id AS TEXT)`

// Wallets returns one finding per wallet, largest positive difference first.
// It only reads.
func Wallets(ctx context.Context, db *gorm.DB) ([]WalletFinding, error) {
	var rows []walletRow
	if err := db.WithContext(ctx).Raw(walletSQL).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]WalletFinding, len(rows))
	for i, r := range rows {
		expected := r.EscrowIn - r.EscrowOut - r.LegacyOrders
		out[i] = WalletFinding{
			UserID: r.UserID, Email: r.Email, Balance: r.Balance,
			Expected: expected, Difference: r.Balance - expected,
			EscrowIn: r.EscrowIn, EscrowOut: r.EscrowOut, LegacyOrders: r.LegacyOrders,
		}
	}
	sort.SliceStable(out, func(a, b int) bool { return out[a].Difference > out[b].Difference })
	return out, nil
}

// Unexplained keeps only wallets whose balance doesn't match their records.
func Unexplained(all []WalletFinding) []WalletFinding {
	var out []WalletFinding
	for _, f := range all {
		if f.Difference != 0 {
			out = append(out, f)
		}
	}
	return out
}
