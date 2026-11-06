package audit

import (
	"context"
	"strings"
	"testing"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func seedEscrow(db *gorm.DB, id, state string, amount int64) {
	db.Create(&domain.Escrow{ID: id, Kind: domain.EscrowKindOrder, Amount: amount, FeeBps: 100, State: state})
}

func entry(db *gorm.DB, escrowID, typ, from, to string, amount int64) {
	db.Create(&domain.LedgerEntry{EscrowID: escrowID, Type: typ, FromAccount: from, ToAccount: to, Amount: amount})
}

func findEscrow(t *testing.T, all []EscrowFinding, id string) (EscrowFinding, bool) {
	t.Helper()
	for _, f := range all {
		if f.EscrowID == id {
			return f, true
		}
	}
	return EscrowFinding{}, false
}

func TestEscrows_BalancedHistoryHasNoFindings(t *testing.T) {
	db := testDB(t)
	// pending: nothing recorded yet
	seedEscrow(db, "E-PEND", domain.EscrowPending, 1000)
	// funded: money held, nothing paid out
	seedEscrow(db, "E-HELD", domain.EscrowFunded, 1000)
	entry(db, "E-HELD", "fund", "buyer", "escrow", 1000)
	// disputed: still held
	seedEscrow(db, "E-DISP", domain.EscrowDisputed, 1000)
	entry(db, "E-DISP", "fund", "buyer", "escrow", 1000)
	// released: 1% fee, 990 net
	seedEscrow(db, "E-REL", domain.EscrowReleased, 1000)
	entry(db, "E-REL", "fund", "buyer", "escrow", 1000)
	entry(db, "E-REL", "release", "escrow", "seller", 990)
	entry(db, "E-REL", "fee", "escrow", "platform", 10)
	// refunded
	seedEscrow(db, "E-REF", domain.EscrowRefunded, 1000)
	entry(db, "E-REF", "fund", "buyer", "escrow", 1000)
	entry(db, "E-REF", "refund", "escrow", "buyer", 1000)
	// delivery fee rows are not escrow money and must not confuse the check
	entry(db, "E-REF", "delivery", "buyer", "platform", 150000)
	entry(db, "E-REF", "refund", "platform", "buyer", 150000)

	got, err := Escrows(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	if bad := Broken(got); len(bad) != 0 {
		t.Fatalf("expected no findings, got %+v", bad)
	}
	if len(got) != 5 {
		t.Fatalf("expected 5 escrows checked, got %d", len(got))
	}
}

func TestEscrows_FlagsEveryWayMoneyCanGoMissing(t *testing.T) {
	db := testDB(t)

	// Released but the seller was paid too little (10 kobo vanished).
	seedEscrow(db, "E-SHORT", domain.EscrowReleased, 1000)
	entry(db, "E-SHORT", "fund", "buyer", "escrow", 1000)
	entry(db, "E-SHORT", "release", "escrow", "seller", 980)
	entry(db, "E-SHORT", "fee", "escrow", "platform", 10)

	// Released twice: paid out more than was funded.
	seedEscrow(db, "E-DOUBLE", domain.EscrowReleased, 1000)
	entry(db, "E-DOUBLE", "fund", "buyer", "escrow", 1000)
	entry(db, "E-DOUBLE", "release", "escrow", "seller", 990)
	entry(db, "E-DOUBLE", "fee", "escrow", "platform", 10)
	entry(db, "E-DOUBLE", "release", "escrow", "seller", 990)

	// Marked released but there is no funding record at all.
	seedEscrow(db, "E-NOFUND", domain.EscrowReleased, 1000)
	entry(db, "E-NOFUND", "release", "escrow", "seller", 990)
	entry(db, "E-NOFUND", "fee", "escrow", "platform", 10)

	// Still held but money already left.
	seedEscrow(db, "E-LEAK", domain.EscrowFunded, 1000)
	entry(db, "E-LEAK", "fund", "buyer", "escrow", 1000)
	entry(db, "E-LEAK", "release", "escrow", "seller", 500)

	// Refunded for less than was funded.
	seedEscrow(db, "E-PARTREF", domain.EscrowRefunded, 1000)
	entry(db, "E-PARTREF", "fund", "buyer", "escrow", 1000)
	entry(db, "E-PARTREF", "refund", "escrow", "buyer", 400)

	// Pending but already has money recorded.
	seedEscrow(db, "E-GHOST", domain.EscrowPending, 1000)
	entry(db, "E-GHOST", "fund", "buyer", "escrow", 1000)

	got, err := Escrows(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"E-SHORT", "E-DOUBLE", "E-NOFUND", "E-LEAK", "E-PARTREF", "E-GHOST"} {
		f, ok := findEscrow(t, got, id)
		if !ok {
			t.Fatalf("%s missing from results", id)
		}
		if f.Problem == "" {
			t.Errorf("%s should be flagged, got no problem", id)
		}
	}
	if n := len(Broken(got)); n != 6 {
		t.Fatalf("expected 6 broken escrows, got %d", n)
	}
	// The message should say what is wrong in plain terms.
	f, _ := findEscrow(t, got, "E-SHORT")
	if !strings.Contains(f.Problem, "10") {
		t.Errorf("problem should name the 10 kobo gap, got %q", f.Problem)
	}
}
