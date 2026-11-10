// Package withdrawal handles seller and artisan bank payouts via Paystack
// Transfers. The flow:
//
//  1. The partner looks up their bank account (ResolveAccount) and sees the
//     name the bank holds it under.
//  2. Initiate checks everything that can fail BEFORE any money moves: payouts
//     are configured, the partner is KYC verified, the bank account exists, and
//     Paystack accepts it as a transfer recipient.
//  3. Then, in one database transaction: the wallet is debited, the withdrawal
//     row is created and the money-out is written to the ledger.
//  4. The transfer is handed to Paystack with a stable reference. If Paystack is
//     briefly unavailable the withdrawal stays "pending" and RetryPending
//     resends it with the SAME reference, so the bank can never pay twice.
//  5. Paystack reports the outcome by webhook (transfer.success / failed /
//     reversed). A failure or reversal returns the money to the wallet exactly
//     once and writes a reversal to the ledger.
package withdrawal

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

var (
	ErrInsufficientBalance = errors.New("insufficient wallet balance")
	ErrKYCRequired         = errors.New("identity verification required before withdrawing")
	ErrMinAmount           = errors.New("minimum withdrawal is ₦1,000")
	ErrNotFound            = errors.New("withdrawal not found")
	ErrDuplicateWithdrawal = errors.New("duplicate withdrawal: this idempotency key was already used")
	// ErrNotConfigured means bank payouts are not set up (no Paystack key). It
	// is raised before any money moves; a payout is never pretended.
	ErrNotConfigured = errors.New("bank payouts are not available yet")
	// ErrAccountNotFound means the bank could not find that account.
	ErrAccountNotFound = errors.New("bank account not found")
)

const minWithdrawalKobo = 100_000 // ₦1,000

// TransferClient is the bank side of a payout. Paystack is the real one; tests
// use a fake.
type TransferClient interface {
	Configured() bool
	// ResolveAccount returns the name the bank holds the account under.
	ResolveAccount(ctx context.Context, accountNumber, bankCode string) (string, error)
	// CreateRecipient saves the account as a transfer recipient and returns its code.
	CreateRecipient(ctx context.Context, name, accountNumber, bankCode string) (string, error)
	// Transfer sends money to a recipient. The reference makes it idempotent.
	Transfer(ctx context.Context, amount int64, recipientCode, reference, reason string) (string, error)
	// VerifyTransfer asks the bank whether it holds a transfer with this
	// reference, and its status. found=false means it has no such transfer.
	VerifyTransfer(ctx context.Context, reference string) (status string, found bool, err error)
}

// Service handles the full withdrawal lifecycle.
type Service struct {
	db     *gorm.DB
	bank   TransferClient
	logger *slog.Logger
}

// NewService builds a service that pays out through Paystack.
func NewService(db *gorm.DB, paystackSecret string, logger *slog.Logger) *Service {
	// PAYSTACK_API_URL points the client somewhere else (a fake Paystack in
	// end-to-end tests); empty means the real https://api.paystack.co.
	return NewServiceWithClient(db, newPaystackClient(paystackSecret, os.Getenv("PAYSTACK_API_URL")), logger)
}

// NewServiceWithClient builds a service around any bank client (used by tests).
func NewServiceWithClient(db *gorm.DB, bank TransferClient, logger *slog.Logger) *Service {
	return &Service{db: db, bank: bank, logger: logger}
}

// WithdrawInput is what the partner submits.
type WithdrawInput struct {
	UserID         string
	Amount         int64  // kobo
	BankCode       string // e.g. "058" for GTBank
	AccountNumber  string
	AccountName    string // what the partner typed; the bank's own name is stored
	IdempotencyKey string // caller-supplied; enforced unique in the database
}

// referenceFor is the id sent to Paystack. Paystack requires 16-50 lowercase
// letters, digits, dashes or underscores, so it is built from the row id and a
// hash of the caller's key instead of using the key as-is.
func referenceFor(w *domain.Withdrawal) string {
	sum := sha256.Sum256([]byte(w.IdempotencyKey))
	return fmt.Sprintf("lb-wd-%d-%s", w.ID, hex.EncodeToString(sum[:])[:10])
}

// ResolveAccount looks up the name a bank account is held under, so the partner
// can confirm it before withdrawing.
func (s *Service) ResolveAccount(ctx context.Context, accountNumber, bankCode string) (string, error) {
	if !s.bank.Configured() {
		return "", ErrNotConfigured
	}
	return s.bank.ResolveAccount(ctx, accountNumber, bankCode)
}

// Initiate debits the wallet and queues the payout. Anything that can fail is
// checked first, so a refused withdrawal never costs the partner anything.
func (s *Service) Initiate(ctx context.Context, in WithdrawInput) (*domain.Withdrawal, error) {
	if in.Amount < minWithdrawalKobo {
		return nil, ErrMinAmount
	}
	if !s.bank.Configured() {
		return nil, ErrNotConfigured
	}

	// KYC gate: partners must be identity-verified before withdrawing.
	var u domain.User
	if err := s.db.WithContext(ctx).Select("id", "kyc_status").First(&u, "id = ?", in.UserID).Error; err != nil {
		return nil, fmt.Errorf("load user: %w", err)
	}
	if u.KYCStatus != "verified" {
		return nil, ErrKYCRequired
	}

	// Everything the bank must accept, before any money moves.
	name, err := s.bank.ResolveAccount(ctx, in.AccountNumber, in.BankCode)
	if err != nil {
		return nil, err
	}
	recipient, err := s.bank.CreateRecipient(ctx, name, in.AccountNumber, in.BankCode)
	if err != nil {
		return nil, fmt.Errorf("create recipient: %w", err)
	}

	w := &domain.Withdrawal{
		UserID:         in.UserID,
		Amount:         in.Amount,
		BankCode:       in.BankCode,
		AccountNumber:  in.AccountNumber,
		AccountName:    name,
		RecipientCode:  recipient,
		IdempotencyKey: in.IdempotencyKey,
		State:          domain.WithdrawalPending,
	}

	// Debit the wallet, create the row and write the ledger entry atomically.
	// The unique index on idempotency_key turns a double submit into a clear error.
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&domain.Wallet{}).
			Where("user_id = ? AND balance >= ?", in.UserID, in.Amount).
			Update("balance", gorm.Expr("balance - ?", in.Amount))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrInsufficientBalance
		}
		if err := tx.Create(w).Error; err != nil {
			// Postgres unique_violation = SQLSTATE 23505
			if msg := strings.ToLower(err.Error()); strings.Contains(msg, "23505") || strings.Contains(msg, "unique") {
				return ErrDuplicateWithdrawal
			}
			return err
		}
		w.Reference = referenceFor(w)
		if err := tx.Model(w).Update("reference", w.Reference).Error; err != nil {
			return err
		}
		return tx.Create(&domain.LedgerEntry{
			EscrowID:    fmt.Sprintf("wd-%d", w.ID),
			Type:        "withdrawal",
			FromAccount: in.UserID,
			ToAccount:   "bank",
			Amount:      in.Amount,
			Memo:        "bank withdrawal",
		}).Error
	})
	if err != nil {
		return nil, err
	}

	// The bank call is outside the transaction. If it fails the withdrawal
	// stays pending and RetryPending sends it again.
	s.startTransfer(ctx, w)
	return w, nil
}

// startTransfer hands a pending withdrawal to the bank. A failure is logged and
// leaves it pending for RetryPending; it never loses the partner's money.
func (s *Service) startTransfer(ctx context.Context, w *domain.Withdrawal) {
	code, err := s.bank.Transfer(ctx, w.Amount, w.RecipientCode, w.Reference, "LuxeBeau withdrawal")
	if err != nil {
		s.logger.Warn("bank transfer not started; will retry",
			slog.Uint64("withdrawal", uint64(w.ID)), slog.Any("error", err))
		return
	}
	res := s.db.WithContext(ctx).Model(&domain.Withdrawal{}).
		Where("id = ? AND state = ?", w.ID, domain.WithdrawalPending).
		Updates(map[string]any{"state": domain.WithdrawalProcessing, "transfer_code": code})
	if res.Error != nil {
		s.logger.Error("could not record started transfer", slog.Uint64("withdrawal", uint64(w.ID)), slog.Any("error", res.Error))
		return
	}
	if res.RowsAffected > 0 {
		w.State = domain.WithdrawalProcessing
		w.TransferCode = code
	}
}

// RetryPending resends payouts that were debited but never reached the bank.
// It reuses each withdrawal's reference, so a payout that did reach the bank
// before a lost reply can never be paid twice. olderThan keeps it from racing a
// withdrawal that is still being started. It returns how many were started.
func (s *Service) RetryPending(ctx context.Context, olderThan time.Duration) (int, error) {
	q := s.db.WithContext(ctx).
		Where("state = ? AND transfer_code = ? AND recipient_code <> ?", domain.WithdrawalPending, "", "")
	if olderThan > 0 {
		q = q.Where("created_at < ?", time.Now().Add(-olderThan).UTC())
	}
	var pending []domain.Withdrawal
	if err := q.Order("id").Limit(50).Find(&pending).Error; err != nil {
		return 0, err
	}
	started := 0
	for i := range pending {
		s.startTransfer(ctx, &pending[i])
		if pending[i].State == domain.WithdrawalProcessing {
			started++
		}
	}
	return started, nil
}

// ExpireStuck gives up on payouts that were debited but have sat unsent for
// longer than olderThan, and returns the money to the seller. A refund is only
// safe if the bank does NOT hold the payout (a request that timed out might
// have been paid after all), so each one is checked with the bank first:
//   - the bank has it and it has not failed: leave it, mark it processing and let
//     the bank's webhook finish it;
//   - the bank has no such transfer, or says it failed: refund once;
//   - the bank cannot be asked right now: change nothing and try again later.
//
// It returns how many were refunded.
func (s *Service) ExpireStuck(ctx context.Context, olderThan time.Duration) (int, error) {
	cutoff := time.Now().Add(-olderThan).UTC()
	var stuck []domain.Withdrawal
	if err := s.db.WithContext(ctx).
		Where("state = ? AND transfer_code = ? AND reference <> ? AND created_at < ?", domain.WithdrawalPending, "", "", cutoff).
		Order("id").Limit(50).Find(&stuck).Error; err != nil {
		return 0, err
	}
	refunded := 0
	for i := range stuck {
		w := stuck[i]
		status, found, err := s.bank.VerifyTransfer(ctx, w.Reference)
		if err != nil {
			s.logger.Warn("cannot check a stuck withdrawal with the bank; leaving it",
				slog.Uint64("withdrawal", uint64(w.ID)), slog.Any("error", err))
			continue
		}
		if found && status != "failed" && status != "reversed" {
			s.db.WithContext(ctx).Model(&domain.Withdrawal{}).
				Where("id = ? AND state = ?", w.ID, domain.WithdrawalPending).
				Update("state", domain.WithdrawalProcessing)
			continue
		}
		done := false
		err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var cur domain.Withdrawal
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&cur, w.ID).Error; err != nil {
				return err
			}
			if cur.State != domain.WithdrawalPending {
				return nil
			}
			if err := s.returnMoney(tx, &cur, domain.WithdrawalFailed, "We couldn't reach your bank in time. Your money was returned to your wallet."); err != nil {
				return err
			}
			done = true
			return nil
		})
		if err != nil {
			s.logger.Error("could not return a stuck withdrawal", slog.Uint64("withdrawal", uint64(w.ID)), slog.Any("error", err))
			continue
		}
		if done {
			refunded++
		}
	}
	return refunded, nil
}

// HandleWebhook processes a Paystack transfer event. The raw body has already
// been signature-verified by the webhook middleware. Each outcome applies at
// most once: a failure or reversal returns the money once, and a late or
// repeated event never rewrites a finished withdrawal.
func (s *Service) HandleWebhook(ctx context.Context, event, reference string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var w domain.Withdrawal
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("reference = ? OR idempotency_key = ?", reference, reference).
			First(&w).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil // not ours
		}
		if err != nil {
			return err
		}

		open := w.State == domain.WithdrawalPending || w.State == domain.WithdrawalProcessing
		switch event {
		case "transfer.success":
			if open {
				return tx.Model(&w).Update("state", domain.WithdrawalSucceeded).Error
			}
		case "transfer.failed":
			if open {
				return s.returnMoney(tx, &w, domain.WithdrawalFailed, "The bank transfer failed")
			}
		case "transfer.reversed":
			if open || w.State == domain.WithdrawalSucceeded {
				return s.returnMoney(tx, &w, domain.WithdrawalReversed, "The bank reversed the transfer")
			}
		}
		return nil
	})
}

// returnMoney gives the withdrawn amount back to the wallet, writes the
// reversal to the ledger and marks the withdrawal finished. It runs inside the
// caller's transaction.
func (s *Service) returnMoney(tx *gorm.DB, w *domain.Withdrawal, state, reason string) error {
	res := tx.Model(&domain.Wallet{}).
		Where("user_id = ?", w.UserID).
		Update("balance", gorm.Expr("balance + ?", w.Amount))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("wallet for %s is missing; cannot return withdrawal %d", w.UserID, w.ID)
	}
	if err := tx.Create(&domain.LedgerEntry{
		EscrowID:    fmt.Sprintf("wd-%d", w.ID),
		Type:        "withdrawal_reversal",
		FromAccount: "bank",
		ToAccount:   w.UserID,
		Amount:      w.Amount,
		Memo:        reason,
	}).Error; err != nil {
		return err
	}
	return tx.Model(w).Updates(map[string]any{"state": state, "fail_reason": reason}).Error
}

// List returns a partner's withdrawal history, newest first.
func (s *Service) List(ctx context.Context, userID string) ([]domain.Withdrawal, error) {
	var list []domain.Withdrawal
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").Limit(100).
		Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}
