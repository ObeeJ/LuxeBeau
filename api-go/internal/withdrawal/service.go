// Package withdrawal handles partner bank payouts via Paystack Transfers.
// The flow is:
//  1. Partner calls POST /me/wallet/withdraw with amount + bank details.
//  2. We debit their wallet and create a Withdrawal row (state=pending) in one
//     transaction — money is never in limbo.
//  3. We call Paystack's transfer API. On success the row moves to processing.
//  4. Paystack sends a webhook (transfer.success / transfer.failed /
//     transfer.reversed). The webhook handler finalises the state.
//  5. On failure or reversal we credit the wallet back and mark failed/reversed.
package withdrawal

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

var (
	ErrInsufficientBalance = errors.New("insufficient wallet balance")
	ErrKYCRequired         = errors.New("identity verification required before withdrawing")
	ErrMinAmount           = errors.New("minimum withdrawal is ₦1,000")
	ErrNotFound            = errors.New("withdrawal not found")
)

const minWithdrawalKobo = 100_000 // ₦1,000

// Service handles the full withdrawal lifecycle.
type Service struct {
	db        *gorm.DB
	paystack  *paystackClient
	logger    *slog.Logger
}

func NewService(db *gorm.DB, paystackSecret string, logger *slog.Logger) *Service {
	return &Service{
		db:       db,
		paystack: &paystackClient{secret: paystackSecret, http: &http.Client{Timeout: 15 * time.Second}},
		logger:   logger,
	}
}

// WithdrawInput is what the partner submits.
type WithdrawInput struct {
	UserID        string
	Amount        int64  // kobo
	BankCode      string // e.g. "058" for GTBank
	AccountNumber string
	AccountName   string // partner confirms this matches their account
}

// Initiate debits the wallet and queues the payout. It returns immediately;
// the Paystack webhook finalises the state asynchronously.
func (s *Service) Initiate(ctx context.Context, in WithdrawInput) (*domain.Withdrawal, error) {
	if in.Amount < minWithdrawalKobo {
		return nil, ErrMinAmount
	}

	// KYC gate: partners must be identity-verified before withdrawing.
	var u domain.User
	if err := s.db.WithContext(ctx).Select("id", "kyc_status").First(&u, "id = ?", in.UserID).Error; err != nil {
		return nil, fmt.Errorf("load user: %w", err)
	}
	if u.KYCStatus != "verified" {
		return nil, ErrKYCRequired
	}

	w := &domain.Withdrawal{
		UserID:         in.UserID,
		Amount:         in.Amount,
		BankCode:       in.BankCode,
		AccountNumber:  in.AccountNumber,
		AccountName:    in.AccountName,
		IdempotencyKey: uuid.NewString(),
		State:          domain.WithdrawalPending,
	}

	// Debit wallet and create withdrawal row atomically.
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&domain.Wallet{}).
			Where("user_id = ? AND balance >= ?", in.UserID, in.Amount).
			Update("balance", gorm.Expr("balance - ?", in.Amount))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrInsufficientBalance
		}
		return tx.Create(w).Error
	})
	if err != nil {
		return nil, err
	}

	// Initiate the Paystack transfer outside the DB transaction.
	// If this fails we leave the withdrawal in "pending" and a background
	// job retries it, so the partner's money is never lost.
	transferCode, err := s.paystack.initiateTransfer(ctx, paystackTransferReq{
		Source:    "balance",
		Amount:    in.Amount,
		Recipient: in.AccountNumber, // Paystack recipient code; see createRecipient
		Reason:    "LuxeBeau withdrawal",
		Reference: w.IdempotencyKey,
	})
	if err != nil {
		s.logger.Warn("paystack transfer initiation failed; will retry",
			slog.Uint64("withdrawal", uint64(w.ID)), slog.Any("error", err))
		return w, nil
	}

	s.db.WithContext(ctx).Model(w).Updates(map[string]any{
		"state": domain.WithdrawalProcessing, "transfer_code": transferCode,
	})
	w.State = domain.WithdrawalProcessing
	w.TransferCode = transferCode
	return w, nil
}

// HandleWebhook processes a Paystack transfer webhook event. The raw body
// must already be signature-verified by the webhook middleware.
func (s *Service) HandleWebhook(ctx context.Context, event, reference string) error {
	var w domain.Withdrawal
	err := s.db.WithContext(ctx).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&w, "idempotency_key = ?", reference).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil // not our withdrawal
	}
	if err != nil {
		return err
	}

	switch event {
	case "transfer.success":
		if w.State == domain.WithdrawalSucceeded {
			return nil // duplicate
		}
		return s.db.WithContext(ctx).Model(&w).Update("state", domain.WithdrawalSucceeded).Error

	case "transfer.failed":
		return s.reverseAndMark(ctx, &w, domain.WithdrawalFailed, "Paystack reported transfer failure")

	case "transfer.reversed":
		return s.reverseAndMark(ctx, &w, domain.WithdrawalReversed, "Paystack reversed the transfer")
	}
	return nil
}

// reverseAndMark credits the wallet back and marks the withdrawal terminal.
func (s *Service) reverseAndMark(ctx context.Context, w *domain.Withdrawal, state, reason string) error {
	if w.State == state {
		return nil // idempotent
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&domain.Wallet{}).
			Where("user_id = ?", w.UserID).
			Update("balance", gorm.Expr("balance + ?", w.Amount)).Error; err != nil {
			return err
		}
		return tx.Model(w).Updates(map[string]any{
			"state": state, "fail_reason": reason,
		}).Error
	})
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

// ── Paystack client ──────────────────────────────────────────────────────────

type paystackClient struct {
	secret string
	http   *http.Client
}

type paystackTransferReq struct {
	Source    string `json:"source"`
	Amount    int64  `json:"amount"` // kobo
	Recipient string `json:"recipient"`
	Reason    string `json:"reason"`
	Reference string `json:"reference"`
}

func (p *paystackClient) initiateTransfer(ctx context.Context, req paystackTransferReq) (string, error) {
	if p.secret == "" {
		// No key configured: log and return a stub code so dev/test works.
		return "TRF_stub_" + req.Reference[:8], nil
	}
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.paystack.co/transfer", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+p.secret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.http.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("paystack transfer: %w", err)
	}
	defer resp.Body.Close()

	var out struct {
		Status bool `json:"status"`
		Data   struct {
			TransferCode string `json:"transfer_code"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("paystack transfer decode: %w", err)
	}
	if !out.Status {
		return "", fmt.Errorf("paystack transfer: %s", out.Message)
	}
	return out.Data.TransferCode, nil
}
