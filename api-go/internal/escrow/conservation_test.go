package escrow

import (
	"context"
	"strings"
	"testing"

	"luxebeau/internal/audit"
	"luxebeau/internal/domain"
)

// Drives the real service through every ending an escrow can have, then asks
// the audit whether the money adds up. If the service and the audit ever
// disagree about what "balanced" means, this is where it shows.
func TestRealFlows_ConserveMoney(t *testing.T) {
	ctx := context.Background()
	s, db := newTestService(t)
	wallet(t, db, buyer, 50000000)
	wallet(t, db, payee, 0)

	createFunded(t, s, db) // stays funded

	released := createFunded(t, s, db)
	if _, err := s.Release(ctx, released.ID, buyer, false); err != nil {
		t.Fatal(err)
	}

	refunded := createFunded(t, s, db)
	if _, err := s.Refund(ctx, refunded.ID, payee, false); err != nil {
		t.Fatal(err)
	}

	disputed := createFunded(t, s, db)
	if _, err := s.Dispute(ctx, disputed.ID, buyer, "never arrived"); err != nil {
		t.Fatal(err)
	}

	resolved := createFunded(t, s, db)
	if _, err := s.Dispute(ctx, resolved.ID, buyer, "wrong item"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Resolve(ctx, resolved.ID, "refund"); err != nil {
		t.Fatal(err)
	}

	got, err := audit.Escrows(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 5 {
		t.Fatalf("expected 5 escrows audited, got %d", len(got))
	}
	if bad := audit.Broken(got); len(bad) != 0 {
		t.Fatalf("real flows should balance, but audit found %+v", bad)
	}

	// Now damage one released escrow's payout, as a bug or a manual edit could.
	// SQLite has no append-only trigger, so the change goes through here; on
	// Postgres the guard would refuse it, and this audit is the second net.
	if err := db.Model(&domain.LedgerEntry{}).
		Where("escrow_id = ? AND type = ?", released.ID, "release").
		Update("amount", 1).Error; err != nil {
		t.Fatal(err)
	}
	got, err = audit.Escrows(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	bad := audit.Broken(got)
	if len(bad) != 1 || bad[0].EscrowID != released.ID {
		t.Fatalf("expected exactly the tampered escrow to be flagged, got %+v", bad)
	}
	if !strings.Contains(bad[0].Problem, "unaccounted") {
		t.Fatalf("problem should say money is unaccounted for, got %q", bad[0].Problem)
	}
}
