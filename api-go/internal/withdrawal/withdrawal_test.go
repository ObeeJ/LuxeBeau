package withdrawal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// fakeBank stands in for Paystack and records what it was asked to do.
type fakeBank struct {
	configured   bool
	resolveName  string
	resolveErr   error
	recipientErr error
	transferErr  error
	verifyFound  bool
	verifyStatus string
	verifyErr    error
	calls        []string
	refs         []string
}

func (f *fakeBank) Configured() bool { return f.configured }
func (f *fakeBank) ResolveAccount(_ context.Context, acct, bank string) (string, error) {
	f.calls = append(f.calls, "resolve")
	return f.resolveName, f.resolveErr
}
func (f *fakeBank) CreateRecipient(_ context.Context, name, acct, bank string) (string, error) {
	f.calls = append(f.calls, "recipient")
	if f.recipientErr != nil {
		return "", f.recipientErr
	}
	return "RCP_fake", nil
}
func (f *fakeBank) Transfer(_ context.Context, amount int64, recipient, ref, reason string) (string, error) {
	f.calls = append(f.calls, "transfer")
	f.refs = append(f.refs, ref)
	if recipient != "RCP_fake" {
		return "", errors.New("transfers need a recipient code, got " + recipient)
	}
	if f.transferErr != nil {
		return "", f.transferErr
	}
	return "TRF_fake", nil
}
func (f *fakeBank) VerifyTransfer(_ context.Context, ref string) (string, bool, error) {
	f.calls = append(f.calls, "verify")
	return f.verifyStatus, f.verifyFound, f.verifyErr
}
func (f *fakeBank) called(what string) int {
	n := 0
	for _, c := range f.calls {
		if c == what {
			n++
		}
	}
	return n
}

const uid = "00000000-0000-0000-0000-0000000000a1"

var dbCounter atomic.Int64

func setup(t *testing.T) (*Service, *fakeBank, *gorm.DB) {
	t.Helper()
	// A fresh database per call, even when a test calls setup in a loop.
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s-%d?mode=memory&cache=shared", t.Name(), dbCounter.Add(1))), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.Withdrawal{}, &domain.LedgerEntry{}); err != nil {
		t.Fatal(err)
	}
	db.Create(&domain.User{ID: uid, Name: "Ada", Email: "ada@test.ng", KYCStatus: "verified"})
	db.Create(&domain.Wallet{UserID: uid, Balance: 1_000_000})
	bank := &fakeBank{configured: true, resolveName: "ADA OBI"}
	return NewServiceWithClient(db, bank, slog.New(slog.NewTextHandler(io.Discard, nil))), bank, db
}

func in(key string, amount int64) WithdrawInput {
	return WithdrawInput{UserID: uid, Amount: amount, BankCode: "058", AccountNumber: "0123456789", AccountName: "Ada Obi", IdempotencyKey: key}
}

func balance(db *gorm.DB) int64 {
	var w domain.Wallet
	db.First(&w, "user_id = ?", uid)
	return w.Balance
}

func ledger(db *gorm.DB, typ string) (n int64, sum int64) {
	db.Model(&domain.LedgerEntry{}).Where("type = ?", typ).Count(&n)
	db.Model(&domain.LedgerEntry{}).Where("type = ?", typ).Select("COALESCE(SUM(amount),0)").Scan(&sum)
	return
}

func TestInitiate_HappyPath(t *testing.T) {
	s, bank, db := setup(t)
	w, err := s.Initiate(context.Background(), in("key-happy-1", 500_000))
	if err != nil {
		t.Fatal(err)
	}
	if w.State != domain.WithdrawalProcessing || w.TransferCode != "TRF_fake" {
		t.Fatalf("state=%s code=%s, want processing / TRF_fake", w.State, w.TransferCode)
	}
	if got := balance(db); got != 500_000 {
		t.Errorf("wallet = %d, want 500000 after taking out 500000", got)
	}
	if n, sum := ledger(db, "withdrawal"); n != 1 || sum != 500_000 {
		t.Errorf("ledger withdrawal rows = %d totalling %d, want 1 / 500000", n, sum)
	}
	if bank.called("resolve") != 1 || bank.called("recipient") != 1 || bank.called("transfer") != 1 {
		t.Errorf("bank calls = %v, want one resolve, one recipient, one transfer", bank.calls)
	}
	if !regexp.MustCompile(`^[a-z0-9_-]{16,50}$`).MatchString(bank.refs[0]) {
		t.Errorf("transfer reference %q must be 16-50 lowercase letters, digits, dashes or underscores (Paystack's rule)", bank.refs[0])
	}
	if w.AccountName != "ADA OBI" {
		t.Errorf("stored account name = %q, want the bank's own name ADA OBI, not what was typed", w.AccountName)
	}
}

func TestInitiate_NothingIsChargedWhenThePayoutCannotHappen(t *testing.T) {
	cases := map[string]func(*fakeBank){
		"payouts not configured": func(b *fakeBank) { b.configured = false },
		"bank account not found": func(b *fakeBank) { b.resolveErr = ErrAccountNotFound },
		"recipient refused":      func(b *fakeBank) { b.recipientErr = errors.New("paystack said no") },
	}
	for name, breakIt := range cases {
		s, bank, db := setup(t)
		breakIt(bank)
		if _, err := s.Initiate(context.Background(), in("key-"+strings.ReplaceAll(name, " ", "-"), 500_000)); err == nil {
			t.Errorf("%s: expected an error", name)
		}
		if got := balance(db); got != 1_000_000 {
			t.Errorf("%s: wallet = %d, want it untouched at 1000000", name, got)
		}
		var rows int64
		db.Model(&domain.Withdrawal{}).Count(&rows)
		if rows != 0 || bank.called("transfer") != 0 {
			t.Errorf("%s: rows=%d transfers=%d, want none", name, rows, bank.called("transfer"))
		}
	}
	// "Not configured" must be its own clear error, never a pretend success.
	s, bank, _ := setup(t)
	bank.configured = false
	if _, err := s.Initiate(context.Background(), in("key-nc-1", 500_000)); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("err = %v, want ErrNotConfigured", err)
	}
}

func TestInitiate_RefusesWhenItShould(t *testing.T) {
	s, bank, db := setup(t)
	ctx := context.Background()
	if _, err := s.Initiate(ctx, in("key-too-much", 2_000_000)); !errors.Is(err, ErrInsufficientBalance) {
		t.Errorf("err = %v, want insufficient balance", err)
	}
	if bank.called("transfer") != 0 || balance(db) != 1_000_000 {
		t.Error("an overdrawn request must not call the bank or touch the wallet")
	}
	if _, err := s.Initiate(ctx, in("key-small", 50_000)); !errors.Is(err, ErrMinAmount) {
		t.Errorf("err = %v, want minimum amount", err)
	}
	db.Model(&domain.User{}).Where("id = ?", uid).Update("kyc_status", "unverified")
	if _, err := s.Initiate(ctx, in("key-kyc-1", 500_000)); !errors.Is(err, ErrKYCRequired) {
		t.Errorf("err = %v, want KYC required", err)
	}
}

func TestInitiate_ShortIdempotencyKeysAreFine(t *testing.T) {
	s, _, db := setup(t)
	if _, err := s.Initiate(context.Background(), in("k", 500_000)); err != nil {
		t.Fatalf("a 1-character key must not crash or fail: %v", err)
	}
	if got := balance(db); got != 500_000 {
		t.Errorf("wallet = %d", got)
	}
}

func TestInitiate_SubmittingTwiceChargesOnce(t *testing.T) {
	s, bank, db := setup(t)
	ctx := context.Background()
	if _, err := s.Initiate(ctx, in("key-twice-1", 500_000)); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Initiate(ctx, in("key-twice-1", 500_000)); !errors.Is(err, ErrDuplicateWithdrawal) {
		t.Fatalf("err = %v, want a duplicate error", err)
	}
	if got := balance(db); got != 500_000 {
		t.Errorf("wallet = %d, want charged once", got)
	}
	if bank.called("transfer") != 1 {
		t.Errorf("transfers = %d, want 1", bank.called("transfer"))
	}
}

func TestInitiate_ABankHiccupKeepsTheRequestAndRetryFinishesIt(t *testing.T) {
	s, bank, db := setup(t)
	ctx := context.Background()
	bank.transferErr = errors.New("paystack unavailable")
	w, err := s.Initiate(ctx, in("key-retry-1", 500_000))
	if err != nil {
		t.Fatalf("a bank hiccup after the debit is not an error for the seller: %v", err)
	}
	if w.State != domain.WithdrawalPending || balance(db) != 500_000 {
		t.Fatalf("state=%s balance=%d, want pending with the money set aside", w.State, balance(db))
	}

	bank.transferErr = nil
	n, err := s.RetryPending(ctx, 0)
	if err != nil || n != 1 {
		t.Fatalf("RetryPending = %d, %v, want 1 payout retried", n, err)
	}
	var got domain.Withdrawal
	db.First(&got, w.ID)
	if got.State != domain.WithdrawalProcessing || got.TransferCode != "TRF_fake" {
		t.Errorf("after retry: state=%s code=%s", got.State, got.TransferCode)
	}
	if len(bank.refs) != 2 || bank.refs[0] != bank.refs[1] {
		t.Errorf("references = %v; a retry must reuse the same reference so the bank can never pay twice", bank.refs)
	}
	if n, _ := s.RetryPending(ctx, 0); n != 0 {
		t.Errorf("a second sweep retried %d, want 0", n)
	}
}

// stuck makes a withdrawal that was debited but never reached the bank, then
// ages it by the given time.
func stuck(t *testing.T, s *Service, bank *fakeBank, db *gorm.DB, key string, age time.Duration) *domain.Withdrawal {
	t.Helper()
	bank.transferErr = errors.New("paystack unavailable")
	w, err := s.Initiate(context.Background(), in(key, 500_000))
	if err != nil {
		t.Fatal(err)
	}
	bank.transferErr = nil
	db.Model(&domain.Withdrawal{}).Where("id = ?", w.ID).Update("created_at", time.Now().Add(-age).UTC())
	return w
}

func TestExpireStuck_ReturnsTheMoneyForAPayoutThatNeverReachedTheBank(t *testing.T) {
	s, bank, db := setup(t)
	ctx := context.Background()
	old := stuck(t, s, bank, db, "key-old-1", 48*time.Hour)

	n, err := s.ExpireStuck(ctx, 24*time.Hour)
	if err != nil || n != 1 {
		t.Fatalf("ExpireStuck = %d, %v, want 1", n, err)
	}
	var got domain.Withdrawal
	db.First(&got, old.ID)
	if got.State != domain.WithdrawalFailed || balance(db) != 1_000_000 {
		t.Errorf("state=%s balance=%d, want failed and the full 1000000 back", got.State, balance(db))
	}
	if n, sum := ledger(db, "withdrawal_reversal"); n != 1 || sum != 500_000 {
		t.Errorf("reversal rows = %d / %d, want 1 / 500000", n, sum)
	}
	if n, _ := s.ExpireStuck(ctx, 24*time.Hour); n != 0 || balance(db) != 1_000_000 {
		t.Errorf("a second sweep refunded again: %d, balance %d", n, balance(db))
	}
	// A late "success" from the bank must not rewrite a refunded withdrawal.
	s.HandleWebhook(ctx, "transfer.success", old.Reference)
	if balance(db) != 1_000_000 {
		t.Error("a late success changed the wallet")
	}
}

func TestExpireStuck_NeverRefundsAPayoutTheBankActuallyHolds(t *testing.T) {
	s, bank, db := setup(t)
	old := stuck(t, s, bank, db, "key-held-1", 48*time.Hour)
	bank.verifyFound, bank.verifyStatus = true, "success"

	n, err := s.ExpireStuck(context.Background(), 24*time.Hour)
	if err != nil || n != 0 {
		t.Fatalf("ExpireStuck = %d, %v, want 0 refunds", n, err)
	}
	var got domain.Withdrawal
	db.First(&got, old.ID)
	if balance(db) != 500_000 {
		t.Errorf("wallet = %d: the bank has this payout, so the seller must not also be refunded", balance(db))
	}
	if got.State != domain.WithdrawalProcessing {
		t.Errorf("state = %s, want processing (the bank has it; its webhook will finish it)", got.State)
	}
}

func TestExpireStuck_RefundsWhenTheBankSaysItFailed(t *testing.T) {
	s, bank, db := setup(t)
	stuck(t, s, bank, db, "key-failed-1", 48*time.Hour)
	bank.verifyFound, bank.verifyStatus = true, "failed"
	if n, _ := s.ExpireStuck(context.Background(), 24*time.Hour); n != 1 || balance(db) != 1_000_000 {
		t.Errorf("refunded %d, balance %d, want 1 and 1000000", n, balance(db))
	}
}

func TestExpireStuck_WaitsWhenTheBankCannotBeAsked(t *testing.T) {
	s, bank, db := setup(t)
	old := stuck(t, s, bank, db, "key-ask-1", 48*time.Hour)
	bank.verifyErr = errors.New("paystack unreachable")
	n, err := s.ExpireStuck(context.Background(), 24*time.Hour)
	if err != nil || n != 0 || balance(db) != 500_000 {
		t.Fatalf("n=%d err=%v balance=%d: with the bank unreachable nothing may be refunded", n, err, balance(db))
	}
	var got domain.Withdrawal
	db.First(&got, old.ID)
	if got.State != domain.WithdrawalPending {
		t.Errorf("state = %s, want it left pending to try again", got.State)
	}
}

func TestExpireStuck_LeavesRecentAndInFlightPayoutsAlone(t *testing.T) {
	s, bank, db := setup(t)
	ctx := context.Background()
	stuck(t, s, bank, db, "key-recent-1", time.Hour)                      // pending but recent
	if _, err := s.Initiate(ctx, in("key-fine-1", 100_000)); err != nil { // reached the bank
		t.Fatal(err)
	}
	if n, _ := s.ExpireStuck(ctx, 24*time.Hour); n != 0 {
		t.Errorf("expired %d, want none", n)
	}
	if balance(db) != 1_000_000-500_000-100_000 {
		t.Errorf("wallet = %d, want both payouts still debited", balance(db))
	}
}

func TestWebhook_SuccessFinishesTheWithdrawalOnce(t *testing.T) {
	s, bank, db := setup(t)
	ctx := context.Background()
	w, _ := s.Initiate(ctx, in("key-wh-ok-1", 500_000))
	ref := bank.refs[0]

	if err := s.HandleWebhook(ctx, "transfer.success", ref); err != nil {
		t.Fatal(err)
	}
	var got domain.Withdrawal
	db.First(&got, w.ID)
	if got.State != domain.WithdrawalSucceeded {
		t.Fatalf("state = %s, want succeeded", got.State)
	}
	s.HandleWebhook(ctx, "transfer.success", ref)
	if balance(db) != 500_000 {
		t.Error("a repeated success changed the wallet")
	}
}

func TestWebhook_FailureRefundsExactlyOnce(t *testing.T) {
	s, bank, db := setup(t)
	ctx := context.Background()
	w, _ := s.Initiate(ctx, in("key-wh-fail-1", 500_000))
	ref := bank.refs[0]

	for i, event := range []string{"transfer.failed", "transfer.failed", "transfer.reversed", "transfer.success"} {
		if err := s.HandleWebhook(ctx, event, ref); err != nil {
			t.Fatalf("%s: %v", event, err)
		}
		if got := balance(db); got != 1_000_000 {
			t.Fatalf("after %s (#%d) wallet = %d, want exactly the original 1000000 (refunded once, never twice)", event, i, got)
		}
	}
	var got domain.Withdrawal
	db.First(&got, w.ID)
	if got.State != domain.WithdrawalFailed {
		t.Errorf("state = %s, want it to stay failed (a later success or reversal must not rewrite it)", got.State)
	}
	if n, sum := ledger(db, "withdrawal_reversal"); n != 1 || sum != 500_000 {
		t.Errorf("reversal rows = %d totalling %d, want 1 / 500000", n, sum)
	}
}

func TestWebhook_ReversalAfterSuccessRefundsOnce(t *testing.T) {
	s, bank, db := setup(t)
	ctx := context.Background()
	s.Initiate(ctx, in("key-wh-rev-1", 500_000))
	ref := bank.refs[0]
	s.HandleWebhook(ctx, "transfer.success", ref)
	s.HandleWebhook(ctx, "transfer.reversed", ref)
	s.HandleWebhook(ctx, "transfer.reversed", ref)
	if got := balance(db); got != 1_000_000 {
		t.Errorf("wallet = %d, want 1000000 after one reversal", got)
	}
}

func TestWebhook_UnknownReferenceIsIgnored(t *testing.T) {
	s, _, db := setup(t)
	if err := s.HandleWebhook(context.Background(), "transfer.failed", "not-ours-0000000000"); err != nil {
		t.Fatal(err)
	}
	if balance(db) != 1_000_000 {
		t.Error("an unknown reference changed a wallet")
	}
}

// The real Paystack client: right addresses, right bodies, errors surfaced.
func TestPaystackClient_SpeaksPaystacksLanguage(t *testing.T) {
	var seen []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer sk_test_x" {
			t.Errorf("missing bearer key on %s", r.URL.Path)
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		seen = append(seen, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/bank/resolve":
			if r.URL.Query().Get("account_number") != "0123456789" || r.URL.Query().Get("bank_code") != "058" {
				t.Errorf("resolve query = %v", r.URL.Query())
			}
			_, _ = w.Write([]byte(`{"status":true,"data":{"account_name":"ADA OBI"}}`))
		case "/transferrecipient":
			if body["type"] != "nuban" || body["currency"] != "NGN" || body["account_number"] != "0123456789" || body["bank_code"] != "058" {
				t.Errorf("recipient body = %v", body)
			}
			_, _ = w.Write([]byte(`{"status":true,"data":{"recipient_code":"RCP_abc"}}`))
		case "/transfer":
			if body["recipient"] != "RCP_abc" || body["source"] != "balance" || body["reference"] != "lb-wd-1-abcdef0123" || body["amount"] != float64(500000) {
				t.Errorf("transfer body = %v", body)
			}
			_, _ = w.Write([]byte(`{"status":true,"data":{"transfer_code":"TRF_xyz"}}`))
		default:
			w.WriteHeader(404)
			_, _ = w.Write([]byte(`{"status":false,"message":"nope"}`))
		}
	}))
	defer srv.Close()

	c := newPaystackClient("sk_test_x", srv.URL)
	ctx := context.Background()
	name, err := c.ResolveAccount(ctx, "0123456789", "058")
	if err != nil || name != "ADA OBI" {
		t.Fatalf("resolve = %q, %v", name, err)
	}
	code, err := c.CreateRecipient(ctx, "ADA OBI", "0123456789", "058")
	if err != nil || code != "RCP_abc" {
		t.Fatalf("recipient = %q, %v", code, err)
	}
	tc, err := c.Transfer(ctx, 500_000, code, "lb-wd-1-abcdef0123", "LuxeBeau withdrawal")
	if err != nil || tc != "TRF_xyz" {
		t.Fatalf("transfer = %q, %v", tc, err)
	}
	if len(seen) != 3 {
		t.Errorf("requests = %v", seen)
	}

	// An unknown account is a clean error, not a crash.
	bad := newPaystackClient("sk_test_x", srv.URL+"/missing")
	if _, err := bad.ResolveAccount(ctx, "0123456789", "058"); err == nil {
		t.Error("a failed lookup must be an error")
	}
	// No key means "not configured", and it never claims success.
	if newPaystackClient("", srv.URL).Configured() {
		t.Error("an empty key must not count as configured")
	}
}
