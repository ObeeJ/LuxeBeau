package audit

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// EscrowFinding checks one escrow against the rule that money is neither
// created nor lost: what the buyer put in must equal what is still held plus
// what has been paid out, charged as a fee, or returned.
//
//	pending            nothing recorded
//	funded / disputed  funded == amount, nothing has left
//	released           funded == amount, released + fee == funded
//	refunded           funded == amount, refunded == funded, nothing paid out
//
// Delivery-fee rows ("delivery", and a "refund" paid from "platform") are not
// escrow money and are ignored here.
type EscrowFinding struct {
	EscrowID string `json:"escrow_id"`
	State    string `json:"state"`
	Amount   int64  `json:"amount"`

	Funded   int64 `json:"funded"`   // buyer money recorded into escrow
	Released int64 `json:"released"` // paid to the payee
	Fee      int64 `json:"fee"`      // taken by the platform
	Refunded int64 `json:"refunded"` // returned to the buyer from escrow

	// Problem is empty when the escrow balances, otherwise a plain sentence.
	Problem string `json:"problem,omitempty"`
}

type escrowRow struct {
	ID       string
	State    string
	Amount   int64
	Funded   int64
	Released int64
	Fee      int64
	Refunded int64
}

// escrowSQL sums each escrow's ledger rows by kind. Only rows that move money
// in or out of the "escrow" account count.
const escrowSQL = `
SELECT e.id AS id, e.state AS state, e.amount AS amount,
  COALESCE((SELECT CAST(SUM(l.amount) AS BIGINT) FROM ledger_entries l
            WHERE l.escrow_id = e.id AND l.type = 'fund' AND l.to_account = 'escrow'), 0) AS funded,
  COALESCE((SELECT CAST(SUM(l.amount) AS BIGINT) FROM ledger_entries l
            WHERE l.escrow_id = e.id AND l.type = 'release' AND l.from_account = 'escrow'), 0) AS released,
  COALESCE((SELECT CAST(SUM(l.amount) AS BIGINT) FROM ledger_entries l
            WHERE l.escrow_id = e.id AND l.type = 'fee' AND l.from_account = 'escrow'), 0) AS fee,
  COALESCE((SELECT CAST(SUM(l.amount) AS BIGINT) FROM ledger_entries l
            WHERE l.escrow_id = e.id AND l.type = 'refund' AND l.from_account = 'escrow'), 0) AS refunded
FROM escrows e
ORDER BY e.id`

// Escrows checks every escrow and returns one finding each; Problem is set on
// the ones that do not balance. It only reads.
func Escrows(ctx context.Context, db *gorm.DB) ([]EscrowFinding, error) {
	var rows []escrowRow
	if err := db.WithContext(ctx).Raw(escrowSQL).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]EscrowFinding, len(rows))
	for i, r := range rows {
		out[i] = EscrowFinding{
			EscrowID: r.ID, State: r.State, Amount: r.Amount,
			Funded: r.Funded, Released: r.Released, Fee: r.Fee, Refunded: r.Refunded,
			Problem: escrowProblem(r),
		}
	}
	return out, nil
}

// Broken keeps only the escrows that do not balance.
func Broken(all []EscrowFinding) []EscrowFinding {
	var out []EscrowFinding
	for _, f := range all {
		if f.Problem != "" {
			out = append(out, f)
		}
	}
	return out
}

func escrowProblem(r escrowRow) string {
	paidOut := r.Released + r.Fee

	switch r.State {
	case domain.EscrowPending:
		if r.Funded != 0 || paidOut != 0 || r.Refunded != 0 {
			return "pending, but money is already recorded against it"
		}
		return ""

	case domain.EscrowFunded, domain.EscrowDisputed:
		if r.Funded != r.Amount {
			return fmt.Sprintf("holds an escrow of %d kobo but %d kobo was recorded as funded", r.Amount, r.Funded)
		}
		if paidOut != 0 || r.Refunded != 0 {
			return fmt.Sprintf("still held, but %d kobo has already left", paidOut+r.Refunded)
		}
		return ""

	case domain.EscrowReleased:
		if r.Funded != r.Amount {
			return fmt.Sprintf("released, but %d kobo was recorded as funded against %d", r.Funded, r.Amount)
		}
		if r.Refunded != 0 {
			return fmt.Sprintf("released, but %d kobo was also refunded", r.Refunded)
		}
		if paidOut != r.Funded {
			return gapMessage("paid out", paidOut, r.Funded)
		}
		return ""

	case domain.EscrowRefunded:
		if r.Funded != r.Amount {
			return fmt.Sprintf("refunded, but %d kobo was recorded as funded against %d", r.Funded, r.Amount)
		}
		if paidOut != 0 {
			return fmt.Sprintf("refunded, but %d kobo was also paid out", paidOut)
		}
		if r.Refunded != r.Funded {
			return gapMessage("refunded", r.Refunded, r.Funded)
		}
		return ""
	}
	return fmt.Sprintf("unknown state %q", r.State)
}

// gapMessage says how far an outflow is from the funded amount, in kobo.
func gapMessage(what string, got, funded int64) string {
	if got < funded {
		return fmt.Sprintf("%s %d of %d kobo funded: %d kobo unaccounted for", what, got, funded, funded-got)
	}
	return fmt.Sprintf("%s %d of %d kobo funded: %d kobo more than was funded", what, got, funded, got-funded)
}
