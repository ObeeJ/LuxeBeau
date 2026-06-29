// Package kyc isolates identity verification (NIN/BVN) behind a provider
// interface so the rest of the app never depends on Prembly directly. The real
// Prembly client is a clean stub today: with no API key configured it returns a
// deterministic "pending" result, so the flow is wired end-to-end and only the
// network call needs filling in once credentials exist.
//
// SECURITY: raw NIN/BVN values are never persisted. Only the resulting status
// (and, in future, a provider reference) is stored on the user record.
package kyc

import (
	"context"
	"log/slog"
	"strings"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

type Kind string

const (
	NIN Kind = "nin"
	BVN Kind = "bvn"
)

// Result is the normalised outcome of a verification attempt.
type Result struct {
	Status    string `json:"status"` // verified, pending, failed
	Reference string `json:"reference,omitempty"`
}

// Provider abstracts the identity vendor (Prembly).
type Provider interface {
	Verify(ctx context.Context, kind Kind, value string) (Result, error)
	Name() string
}

// PremblyProvider talks to Prembly's Identity Pass API. Without an API key it
// degrades to a stub that returns "pending" (queued for manual review).
type PremblyProvider struct {
	apiKey string
	appID  string
	logger *slog.Logger
}

func NewPremblyProvider(apiKey, appID string, logger *slog.Logger) *PremblyProvider {
	return &PremblyProvider{apiKey: apiKey, appID: appID, logger: logger}
}

func (p *PremblyProvider) Name() string { return "prembly" }

func (p *PremblyProvider) Verify(ctx context.Context, kind Kind, value string) (Result, error) {
	if p.apiKey == "" {
		// No credentials yet: accept the submission and queue it for review.
		p.logger.Info("KYC stub: no Prembly key, queuing for manual review", slog.String("kind", string(kind)))
		return Result{Status: "pending"}, nil
	}
	// TODO: real Prembly call once keys are provisioned, e.g.
	//   POST https://api.prembly.com/identitypass/verification/{nin|bvn}
	//   headers: x-api-key, app-id; body: {number: value}
	// Map the vendor response to Result{Status,Reference}.
	p.logger.Info("KYC verify via Prembly", slog.String("kind", string(kind)))
	return Result{Status: "pending"}, nil
}

// Service runs a verification and records only the status on the user.
type Service struct {
	provider Provider
	db       *gorm.DB
	logger   *slog.Logger
}

func NewService(provider Provider, db *gorm.DB, logger *slog.Logger) *Service {
	return &Service{provider: provider, db: db, logger: logger}
}

func (s *Service) Submit(ctx context.Context, userID string, kind Kind, value string) (Result, error) {
	value = strings.TrimSpace(value)
	// Mark pending immediately so the UI reflects the in-flight state.
	s.setStatus(ctx, userID, "pending")

	res, err := s.provider.Verify(ctx, kind, value)
	if err != nil {
		s.setStatus(ctx, userID, "failed")
		return Result{Status: "failed"}, err
	}
	s.setStatus(ctx, userID, res.Status)
	return res, nil
}

func (s *Service) setStatus(ctx context.Context, userID, status string) {
	if err := s.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ?", userID).Update("kyc_status", status).Error; err != nil {
		s.logger.Warn("failed to update kyc status", slog.String("user", userID), slog.Any("error", err))
	}
}
