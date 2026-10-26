package escrow

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func newTestService(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&domain.Wallet{}, &domain.Escrow{}, &domain.LedgerEntry{}, &domain.Artisan{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	db.Exec("DELETE FROM wallets")
	db.Exec("DELETE FROM escrows")
	db.Exec("DELETE FROM ledger_entries")
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	rails := NewRegistry(NewWalletSettlement(logger), NewCNGNSettlement(logger))
	return NewService(NewGormRepository(db), rails, NewLogNotifier(logger), logger), db
}

const buyer = "00000000-0000-0000-0000-0000000000b1"
const payee = "00000000-0000-0000-0000-0000000000p1"

func wallet(t *testing.T, db *gorm.DB, id string, bal int64) {
	t.Helper()
	if err := db.Create(&domain.Wallet{UserID: id, Balance: bal}).Error; err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
}

func createFunded(t *testing.T, s *Service, db *gorm.DB) *domain.Escrow {
	t.Helper()
	e, err := s.Create(context.Background(), CreateInput{Kind: domain.EscrowKindOrder, BuyerID: buyer, PayeeID: payee, Title: "Dunks", Amount: 4000000})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := s.Fund(context.Background(), e.ID); err != nil {
		t.Fatalf("fund: %v", err)
	}
	return e
}

func TestHappyPath_FundThenRelease(t *testing.T) {
	s, db := newTestService(t)
	wallet(t, db, buyer, 5000000)
	wallet(t, db, payee, 0)

	e := createFunded(t, s, db)

	// Buyer debited.
	var bw domain.Wallet
	db.First(&bw, "user_id = ?", buyer)
	if bw.Balance != 1000000 {
		t.Fatalf("buyer balance = %d, want 1000000", bw.Balance)
	}

	released, err := s.Release(context.Background(), e.ID, buyer, false)
	if err != nil {
		t.Fatal(err)
	}
	if released.State != domain.EscrowReleased {
		t.Fatalf("state = %s", released.State)
	}
	// Payee paid net of 1% fee: 4,000,000 - 40,000 = 3,960,000.
	var pw domain.Wallet
	db.First(&pw, "user_id = ?", payee)
	if pw.Balance != 3960000 {
		t.Fatalf("payee balance = %d, want 3960000", pw.Balance)
	}
	// Ledger has fund, release, fee.
	var entries int64
	db.Model(&domain.LedgerEntry{}).Where("escrow_id = ?", e.ID).Count(&entries)
	if entries != 3 {
		t.Fatalf("ledger entries = %d, want 3", entries)
	}
}

func TestFund_InsufficientBalance(t *testing.T) {
	s, db := newTestService(t)
	wallet(t, db, buyer, 100) // too low
	e, _ := s.Create(context.Background(), CreateInput{Kind: domain.EscrowKindOrder, BuyerID: buyer, PayeeID: payee, Title: "x", Amount: 4000000})
	if _, err := s.Fund(context.Background(), e.ID); err == nil {
		t.Fatal("expected insufficient balance error")
	}
	// State stays pending; nothing debited.
	got, _ := s.Get(context.Background(), e.ID)
	if got.State != domain.EscrowPending {
		t.Fatalf("state = %s, want pending", got.State)
	}
}

func TestDisputeThenAdminRefund(t *testing.T) {
	s, db := newTestService(t)
	wallet(t, db, buyer, 5000000)
	wallet(t, db, payee, 0)
	e := createFunded(t, s, db)

	if _, err := s.Dispute(context.Background(), e.ID, buyer, "never arrived"); err != nil {
		t.Fatal(err)
	}
	refunded, err := s.Resolve(context.Background(), e.ID, "refund")
	if err != nil {
		t.Fatal(err)
	}
	if refunded.State != domain.EscrowRefunded {
		t.Fatalf("state = %s", refunded.State)
	}
	var bw domain.Wallet
	db.First(&bw, "user_id = ?", buyer)
	if bw.Balance != 5000000 {
		t.Fatalf("buyer not made whole: %d", bw.Balance)
	}
}

func TestRelease_OnlyBuyerOrAdmin(t *testing.T) {
	s, db := newTestService(t)
	wallet(t, db, buyer, 5000000)
	wallet(t, db, payee, 0)
	e := createFunded(t, s, db)

	if _, err := s.Release(context.Background(), e.ID, "someone-else", false); err == nil {
		t.Fatal("expected authorisation error")
	}
}

func TestAutoReleaseSweep(t *testing.T) {
	s, db := newTestService(t)
	wallet(t, db, buyer, 5000000)
	wallet(t, db, payee, 0)
	e := createFunded(t, s, db)
	// Force the release window into the past.
	db.Model(&domain.Escrow{}).Where("id = ?", e.ID).Update("release_eligible_at", db.NowFunc().Add(-1))

	n, err := s.SweepAutoReleases(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("swept %d, want 1", n)
	}
	got, _ := s.Get(context.Background(), e.ID)
	if got.State != domain.EscrowReleased {
		t.Fatalf("state = %s, want released", got.State)
	}
}

func TestRefund_PayeeOrAdminOnly(t *testing.T) {
	s, db := newTestService(t)
	wallet(t, db, buyer, 5000000)
	wallet(t, db, payee, 0)
	e := createFunded(t, s, db)

	// The buyer can't pull funded money back on their own; they must dispute.
	if _, err := s.Refund(context.Background(), e.ID, buyer, false); err == nil {
		t.Fatal("buyer refunded their own funded escrow")
	}
	if _, err := s.Refund(context.Background(), e.ID, "someone-else", false); err == nil {
		t.Fatal("a stranger refunded the escrow")
	}
	refunded, err := s.Refund(context.Background(), e.ID, payee, false)
	if err != nil || refunded.State != domain.EscrowRefunded {
		t.Fatalf("payee refund: state=%v err=%v", refunded, err)
	}
	// A second refund of the same escrow is refused and pays nothing.
	if _, err := s.Refund(context.Background(), e.ID, payee, false); err == nil {
		t.Fatal("escrow refunded twice")
	}
	var bw domain.Wallet
	db.First(&bw, "user_id = ?", buyer)
	if bw.Balance != 5000000 {
		t.Fatalf("buyer balance = %d, want exactly 5000000", bw.Balance)
	}
}

func TestLedgerFailureRollsBackMoneyMovement(t *testing.T) {
	s, db := newTestService(t)
	wallet(t, db, buyer, 5000000)
	wallet(t, db, payee, 0)
	e, err := s.Create(context.Background(), CreateInput{Kind: domain.EscrowKindOrder, BuyerID: buyer, PayeeID: payee, Title: "Dunks", Amount: 4000000})
	if err != nil {
		t.Fatal(err)
	}
	// Break the ledger so its write fails inside the funding transaction.
	if err := db.Migrator().DropTable(&domain.LedgerEntry{}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.AutoMigrate(&domain.LedgerEntry{}) })

	if _, err := s.Fund(context.Background(), e.ID); err == nil {
		t.Fatal("funding succeeded without a ledger entry")
	}
	var bw domain.Wallet
	db.First(&bw, "user_id = ?", buyer)
	var got domain.Escrow
	db.First(&got, "id = ?", e.ID)
	if bw.Balance != 5000000 || got.State == domain.EscrowFunded {
		t.Fatalf("money moved without a ledger record: balance=%d state=%s", bw.Balance, got.State)
	}
}

func TestLogNotifierOmitsPersonalData(t *testing.T) {
	var buf bytes.Buffer
	n := NewLogNotifier(slog.New(slog.NewTextHandler(&buf, nil)))
	e := &domain.Escrow{ID: "ESC-1", Title: "Dunks", Amount: 4000000, BuyerName: "Ada Obi"}
	if err := n.Notify(context.Background(), "+2348030000001", EventFunded, e); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(buf.String(), "2348030000001") || strings.Contains(buf.String(), "Ada Obi") {
		t.Fatalf("log contains personal data: %s", buf.String())
	}
}
